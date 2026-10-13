import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { fetchAllEmployees } from "@/lib/firebase/hr";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { EtimeClient } from "@/lib/etime/client";
import { getEtimeConfig } from "@/lib/etime/config";
import {
  buildSourceEmployeeMaps,
  type SyncEligibleEmployee,
} from "@/lib/attendance-sync/employee-sync";
import {
  listEligiblePunchesBySourceDate,
  voidPunch,
  writeCanonicalPunchIfNew,
} from "@/lib/attendance-sync/punch-store";
import { reconcileMosqueAttendanceDate } from "@/lib/attendance-sync/reconcile";
import { reconcileCouncilAttendanceDate } from "@/lib/attendance-sync/council";
import { isAttendanceSyncAutoWriteEnabled } from "@/lib/attendance-sync/runtime";
import { assertIsoDate, utcToMaldivesParts } from "@/lib/attendance-sync/time";
import type { AttendancePunchDoc, ImportResult } from "@/lib/attendance-sync/types";
import { ETIME_MAX_DAYS, MALDIVES_TIMEZONE } from "@/lib/attendance-sync/types";

const STATUS_DOC_ID = "etime-portal";
/** Status doc heartbeat while polls find nothing new; the admin panel calls eTime stale after 15 min. */
const QUIET_STATUS_INTERVAL_MS = 5 * 60_000;

// Incremental (worker) polls remember each date's last snapshot so an unchanged
// eTime page costs no Firestore reads or writes.
const lastSnapshotHashByDate = new Map<string, string>();
let lastStatusWriteAt = 0;

function snapshotHash(
  rows: Array<{ employeeCode: string; departmentId: string; timestampUtc?: string | null; sourceRecordId?: string | null; ignored?: boolean; ignoredReason?: string | null }>,
  maps: ReturnType<typeof buildSourceEmployeeMaps>,
): string {
  // Includes the employee mapping, so a newly mapped eTime code re-matches its punches.
  const mapping = Array.from(maps.etimeByCode.entries())
    .map(([code, entry]) => [code, entry.employee.$id, entry.config.etime?.departmentId ?? ""])
    .sort();
  const rowKeys = rows
    .map((row) => [row.employeeCode, row.departmentId, row.timestampUtc ?? "", row.sourceRecordId ?? "",
      Boolean(row.ignored), row.ignoredReason ?? ""])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha1")
    .update(JSON.stringify([rowKeys, mapping, Array.from(maps.byEmployeeId.keys()).sort()]))
    .digest("hex");
}

export type EtimeIntegrationStatus = {
  enabled?: boolean;
  lastHeartbeatAt?: string | null;
  lastImportStartedAt?: string | null;
  lastImportCompletedAt?: string | null;
  lastSuccessfulDate?: string | null;
  lastError?: string | null;
  parserErrors?: string[];
  unmatched?: number;
  updatedAt?: string | null;
};

export async function getEtimeStatus(): Promise<EtimeIntegrationStatus | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(STATUS_DOC_ID)
    .get();
  if (!snap.exists) return null;
  return { ...(snap.data() as EtimeIntegrationStatus) };
}

export async function updateEtimeStatus(
  patch: Omit<Partial<EtimeIntegrationStatus>, "$id">,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(STATUS_DOC_ID)
    .set(
      {
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

function matchEtimeEmployee(
  employeeCode: string,
  departmentId: string,
  maps: ReturnType<typeof buildSourceEmployeeMaps>,
): SyncEligibleEmployee | null {
  const direct = maps.etimeByCode.get(employeeCode);
  if (!direct) return null;
  const configuredDept = direct.config.etime?.departmentId?.trim();
  if (configuredDept && departmentId && configuredDept !== departmentId) return null;
  return direct;
}

function etimeDedupeKey(employeeCode: string, timestampUtc: string): string {
  const seconds = Math.floor(new Date(timestampUtc).getTime() / 1000);
  return `etime-${employeeCode}-${seconds}`;
}

export async function importEtimePunches(options: {
  from: string;
  to?: string;
  reconcile?: boolean;
  client?: EtimeClient;
  /**
   * For the always-on worker: skip dates whose eTime snapshot matches the
   * previous poll, reconcile only dates whose punches changed, and write the
   * status doc only when something changed or every few minutes.
   */
  incremental?: boolean;
}): Promise<ImportResult> {
  const incremental = options.incremental === true;
  const config = getEtimeConfig();
  if (!config.enabled) {
    throw new Error("eTime integration is disabled. Set ETIME_ENABLED=1.");
  }
  if (config.errors.length > 0) {
    throw new Error(config.errors.join(" "));
  }

  assertIsoDate(options.from);
  const to = options.to ?? options.from;
  assertIsoDate(to);

  const { enumerateIsoDates, addDaysIso, todayMaldivesIso } = await import(
    "@/lib/attendance-sync/time"
  );
  const dates = enumerateIsoDates(options.from, to);
  const oldestAllowed = addDaysIso(todayMaldivesIso(), -ETIME_MAX_DAYS);
  if (options.from < oldestAllowed) {
    throw new Error(`eTime import limited to ${ETIME_MAX_DAYS} days.`);
  }

  const client = options.client ?? EtimeClient.fromEnv();
  const employees = await fetchAllEmployees();

  let scanned = 0;
  let valid = 0;
  let written = 0;
  let skipped = 0;
  let unmatched = 0;
  let voided = 0;
  const affectedDates = new Set<string>();
  const parserErrors: string[] = [];

  const importStartedAt = new Date().toISOString();
  if (!incremental) {
    await updateEtimeStatus({
      enabled: true,
      lastImportStartedAt: importStartedAt,
      lastError: null,
    });
  }
  let changedAnything = false;
  const completedHashes = new Map<string, string>();

  try {
    for (const date of dates) {
      const maps = buildSourceEmployeeMaps(employees, date);
      const snapshot = await client.fetchSnapshotWithTimestamps(date);
      scanned += snapshot.rows.length;
      parserErrors.push(...snapshot.parserErrors);

      if (!snapshot.complete) {
        parserErrors.push(`Incomplete eTime snapshot for ${date}; skipping void pass.`);
        continue;
      }
      const hash = incremental ? snapshotHash(snapshot.rows, maps) : "";
      if (incremental && lastSnapshotHashByDate.get(date) === hash) continue;

      const seenDocIds = new Set<string>();
      const now = new Date().toISOString();

      for (const row of snapshot.rows) {
        if (!row.timestampUtc) continue;
        const matched = matchEtimeEmployee(row.employeeCode, row.departmentId, maps);
        const { localDate, localTime } = utcToMaldivesParts(row.timestampUtc);
        const dedupeKey = etimeDedupeKey(row.employeeCode, row.timestampUtc);

        valid += 1;
        if (!matched) unmatched += 1;

        const punch: AttendancePunchDoc = {
          source: "etime",
          sourceRecordId: row.sourceRecordId,
          sourceDeviceId: null,
          sourceEmployeeId: row.employeeCode,
          employeeId: matched?.employee.$id ?? null,
          timestampUtc: row.timestampUtc,
          localDate,
          localTime,
          timezone: MALDIVES_TIMEZONE,
          eligible: !row.ignored,
          ignoredReason: row.ignored ? row.ignoredReason : null,
          lastSeenAt: now,
          voidedAt: null,
          importedAt: now,
          dedupeKey,
        };

        const result = await writeCanonicalPunchIfNew(punch);
        seenDocIds.add(result.docId);
        if (result.changed) changedAnything = true;
        if (incremental) {
          // The worker repairs unchanged days on its own hourly pass.
          if (result.changed) affectedDates.add(localDate);
        } else if (matched && punch.eligible) {
          // A repeated import must also repair attendance from existing punches.
          affectedDates.add(localDate);
        }
        if (result.written) {
          written += 1;
        } else {
          skipped += 1;
        }
      }

      const existing = await listEligiblePunchesBySourceDate("etime", date);
      for (const doc of existing) {
        if (seenDocIds.has(doc.$id)) continue;
        if (doc.employeeId && !maps.byEmployeeId.has(doc.employeeId)) continue;
        await voidPunch(doc.$id, now);
        voided += 1;
        changedAnything = true;
        if (doc.employeeId) affectedDates.add(date);
      }
      if (incremental) completedHashes.set(date, hash);
    }

    const quiet = incremental && !changedAnything && parserErrors.length === 0 &&
      Date.now() - lastStatusWriteAt < QUIET_STATUS_INTERVAL_MS;
    if (!quiet) {
      await updateEtimeStatus({
        enabled: true,
        lastImportStartedAt: importStartedAt,
        lastImportCompletedAt: new Date().toISOString(),
        lastSuccessfulDate: to,
        lastHeartbeatAt: new Date().toISOString(),
        parserErrors: parserErrors.slice(-20),
        unmatched,
        lastError: parserErrors.length > 0 ? parserErrors[parserErrors.length - 1]! : null,
      });
      lastStatusWriteAt = Date.now();
    }
  } catch (error) {
    await updateEtimeStatus({
      lastError: error instanceof Error ? error.message : String(error),
      lastImportCompletedAt: new Date().toISOString(),
    });
    throw error;
  }

  if (options.reconcile !== false && isAttendanceSyncAutoWriteEnabled()) {
    for (const date of Array.from(affectedDates)) {
      await reconcileMosqueAttendanceDate(date, undefined, { preview: false });
      await reconcileCouncilAttendanceDate(date, { preview: false, ensureToday: true });
    }
  }
  // Remembered only once the punches are stored and reconciled, so a failed poll retries.
  for (const [date, hash] of completedHashes) lastSnapshotHashByDate.set(date, hash);

  return {
    scanned,
    valid,
    written,
    skipped,
    unmatched,
    voided,
    affectedDates: Array.from(affectedDates).sort(),
    from: options.from,
    to,
  };
}

export async function testEtimeConnection(): Promise<{ ok: boolean; message: string }> {
  const client = EtimeClient.fromEnv();
  try {
    const result = await client.testConnection();
    await updateEtimeStatus({
      enabled: true,
      lastHeartbeatAt: new Date().toISOString(),
      lastError: null,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateEtimeStatus({
      enabled: true,
      lastError: message,
      lastHeartbeatAt: new Date().toISOString(),
    });
    throw error;
  }
}
