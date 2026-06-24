import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import type { EmployeeDoc, PunchLogRaw } from "@/lib/firebase/types";
import {
  normalizeHumanName,
  type EmployeePunchMatch,
  type NormalizedPunch,
} from "@/lib/zk/normalize";

export type PunchWriteResult = {
  written: boolean;
  punch: NormalizedPunch;
};

export type ZkIntegrationStatus = {
  $id?: string;
  enabled?: boolean;
  running?: boolean;
  deviceIp?: string;
  devicePort?: number;
  deviceSerial?: string | null;
  lastLogCount?: number | null;
  lastHeartbeatAt?: string | null;
  lastSyncStartedAt?: string | null;
  lastSyncCompletedAt?: string | null;
  lastWriteAt?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

const STATUS_DOC_ID = "zk-device";

const EMP_KEY_CANDIDATES = [
  "deviceid",
  "device_id",
  "deviceuserid",
  "recordcardnumber",
  "empid",
  "employeeid",
  "code",
  "id",
];

function pickEmployeeDeviceKey(employee: EmployeeDoc): string | null {
  const entries = Object.entries(employee);
  const byLower = new Map(entries.map(([key, value]) => [key.toLowerCase(), value]));

  for (const field of EMP_KEY_CANDIDATES) {
    const value = byLower.get(field);
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

export async function loadEmployeePunchMap(): Promise<
  Map<string, EmployeePunchMatch>
> {
  const snap = await getFirestoreDb().collection(COLLECTIONS.employees).get();
  const map = new Map<string, EmployeePunchMatch>();

  for (const doc of snap.docs) {
    const employee = { $id: doc.id, ...doc.data() } as EmployeeDoc;
    const key = pickEmployeeDeviceKey(employee);
    const name = employee.name?.trim();
    if (!key || !name) continue;
    map.set(key, { name, norm: normalizeHumanName(name) });
  }

  return map;
}

export async function writePunchIfNew(
  punch: NormalizedPunch,
): Promise<PunchWriteResult> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.punchLogs).doc(punch.dedupeKey);
  const existing = await ref.get();

  if (existing.exists) {
    return { written: false, punch };
  }

  await ref.set(punch);
  return { written: true, punch };
}

export async function listRecentPunches(limit = 10): Promise<PunchLogRaw[]> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ $id: doc.id, ...doc.data() }) as PunchLogRaw);
}

export async function getLatestPunch(): Promise<PunchLogRaw | null> {
  const rows = await listRecentPunches(1);
  return rows[0] ?? null;
}

export async function getZkStatus(): Promise<ZkIntegrationStatus | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(STATUS_DOC_ID)
    .get();

  if (!snap.exists) return null;
  return { $id: snap.id, ...snap.data() } as ZkIntegrationStatus;
}

export async function updateZkStatus(
  patch: Omit<Partial<ZkIntegrationStatus>, "$id">,
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
