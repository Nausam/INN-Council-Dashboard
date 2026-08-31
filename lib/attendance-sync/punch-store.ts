import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { utcToMaldivesParts } from "@/lib/attendance-sync/time";
import type { AttendancePunchDoc, AttendancePunchSource } from "@/lib/attendance-sync/types";

export type PunchWriteResult = {
  written: boolean;
  punch: AttendancePunchDoc;
  docId: string;
};

export type PunchLookupOptions = {
  zkUserId?: string | null;
  etimeCode?: string | null;
};

function canonicalDocId(source: AttendancePunchSource, dedupeKey: string): string {
  return `${source}_${dedupeKey}`;
}

function maldivesDayUtcBounds(localDate: string): { startUtc: string; endUtc: string } {
  return {
    startUtc: new Date(`${localDate}T00:00:00+05:00`).toISOString(),
    endUtc: new Date(`${localDate}T23:59:59.999+05:00`).toISOString(),
  };
}

function normalizeStoredPunch(
  id: string,
  data: Record<string, unknown>,
  employeeId: string,
): (AttendancePunchDoc & { $id: string }) | null {
  const timestampUtc = String(data.timestampUtc ?? data.timestamp ?? "");
  if (!timestampUtc) return null;

  const parts = utcToMaldivesParts(timestampUtc);
  const source = (data.source as AttendancePunchSource | undefined) ?? "zkteco";
  const eligible = data.eligible !== false && !data.voidedAt;

  return {
    $id: id,
    source,
    sourceRecordId: String(data.sourceRecordId ?? data.dedupeKey ?? id),
    sourceDeviceId: (data.sourceDeviceId as string | null) ?? (data.deviceSn as string | null) ?? null,
    sourceEmployeeId: String(
      data.sourceEmployeeId ?? data.deviceUserId ?? data.empId ?? "",
    ),
    employeeId: String(data.employeeId ?? employeeId),
    timestampUtc,
    localDate: String(data.localDate ?? parts.localDate),
    localTime: String(data.localTime ?? parts.localTime),
    timezone: "Asia/Maldives",
    eligible,
    ignoredReason: (data.ignoredReason as string | null) ?? null,
    lastSeenAt: String(data.lastSeenAt ?? data.createdAt ?? timestampUtc),
    voidedAt: (data.voidedAt as string | null) ?? null,
    importedAt: String(data.importedAt ?? data.createdAt ?? timestampUtc),
    dedupeKey: String(data.dedupeKey ?? id),
    timestamp: timestampUtc,
    deviceUserId: data.deviceUserId as string | undefined,
    empId: data.empId as string | undefined,
    deviceSn: data.deviceSn as string | undefined,
    createdAt: data.createdAt as string | undefined,
  };
}

async function queryLegacyZkPunches(
  zkUserId: string,
  localDate: string,
  employeeId: string,
): Promise<Array<AttendancePunchDoc & { $id: string }>> {
  const { startUtc, endUtc } = maldivesDayUtcBounds(localDate);
  const startMs = new Date(startUtc).getTime();
  const endMs = new Date(endUtc).getTime();

  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .where("deviceUserId", "==", zkUserId)
    .limit(500)
    .get();

  const rows: Array<AttendancePunchDoc & { $id: string }> = [];
  for (const doc of snap.docs) {
    const normalized = normalizeStoredPunch(doc.id, doc.data(), employeeId);
    if (!normalized) continue;
    const punchMs = new Date(normalized.timestampUtc).getTime();
    if (punchMs < startMs || punchMs > endMs) continue;
    if (normalized.localDate !== localDate) continue;
    if (!normalized.eligible || normalized.voidedAt) continue;
    rows.push(normalized);
  }
  return rows;
}

async function queryCanonicalPunches(
  employeeId: string,
  localDate: string,
): Promise<Array<AttendancePunchDoc & { $id: string }>> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .where("employeeId", "==", employeeId)
    .where("localDate", "==", localDate)
    .get();

  return snap.docs
    .map((doc) => normalizeStoredPunch(doc.id, doc.data(), employeeId))
    .filter((row): row is AttendancePunchDoc & { $id: string } => Boolean(row))
    .filter((row) => row.eligible && !row.voidedAt);
}

export async function writeCanonicalPunchIfNew(
  punch: AttendancePunchDoc,
): Promise<PunchWriteResult> {
  const db = getFirestoreDb();
  const docId = canonicalDocId(punch.source, punch.dedupeKey);
  const ref = db.collection(COLLECTIONS.punchLogs).doc(docId);
  const existing = await ref.get();

  if (existing.exists) {
    await ref.set(
      {
        lastSeenAt: punch.lastSeenAt,
        employeeId: punch.employeeId ?? existing.data()?.employeeId ?? null,
        eligible: punch.eligible,
        ignoredReason: punch.ignoredReason,
        voidedAt: punch.voidedAt,
      },
      { merge: true },
    );
    return {
      written: false,
      punch: { ...punch, ...(existing.data() as AttendancePunchDoc) },
      docId,
    };
  }

  const payload: AttendancePunchDoc = {
    ...punch,
    timestamp: punch.timestampUtc,
    deviceUserId: punch.source === "zkteco" ? punch.sourceEmployeeId : undefined,
    empId: punch.source === "zkteco" ? punch.sourceEmployeeId : undefined,
    deviceSn: punch.sourceDeviceId ?? undefined,
    createdAt: punch.importedAt,
  };

  await ref.set(payload);
  return { written: true, punch: payload, docId };
}

export async function voidPunch(docId: string, voidedAt: string): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .doc(docId)
    .set(
      {
        voidedAt,
        eligible: false,
        ignoredReason: "voided_by_snapshot",
        lastSeenAt: voidedAt,
      },
      { merge: true },
    );
}

export async function listEligiblePunchesForEmployeeDate(
  employeeId: string,
  localDate: string,
  options: PunchLookupOptions = {},
): Promise<Array<AttendancePunchDoc & { $id: string }>> {
  let rows: Array<AttendancePunchDoc & { $id: string }> = [];

  try {
    rows = await queryCanonicalPunches(employeeId, localDate);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 9) throw error;
  }

  if (rows.length === 0 && options.zkUserId?.trim()) {
    rows = await queryLegacyZkPunches(options.zkUserId.trim(), localDate, employeeId);
  }

  const byId = new Map<string, AttendancePunchDoc & { $id: string }>();
  for (const row of rows) {
    byId.set(row.$id, row);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime(),
  );
}

export async function listEligiblePunchesBySourceDate(
  source: AttendancePunchSource,
  localDate: string,
): Promise<Array<AttendancePunchDoc & { $id: string }>> {
  try {
    const snap = await getFirestoreDb()
      .collection(COLLECTIONS.punchLogs)
      .where("source", "==", source)
      .where("localDate", "==", localDate)
      .get();

    return snap.docs.map((doc) => ({ $id: doc.id, ...(doc.data() as AttendancePunchDoc) }));
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 9) throw error;
    return [];
  }
}

export async function touchPunchLastSeen(docId: string): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .doc(docId)
    .set(
      {
        lastSeenAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function countUnmatchedPunches(limit = 100): Promise<number> {
  try {
    const snap = await getFirestoreDb()
      .collection(COLLECTIONS.punchLogs)
      .where("employeeId", "==", null)
      .where("eligible", "==", true)
      .limit(limit)
      .get();
    return snap.size;
  } catch {
    const snap = await getFirestoreDb()
      .collection(COLLECTIONS.punchLogs)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snap.docs.filter((doc) => !doc.data().employeeId).length;
  }
}
