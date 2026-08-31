import { withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees } from "@/lib/firebase/hr";
import type { MosqueAttendanceDoc } from "@/lib/firebase/types";
import { fromFirestoreDocs } from "@/lib/firebase/adapters";
import { listSyncEligibleEmployees } from "@/lib/attendance-sync/employee-sync";
import { isAttendanceSyncAutoWriteEnabled } from "@/lib/attendance-sync/runtime";
import type { EnsureResult } from "@/lib/attendance-sync/types";
import { assertIsoDate } from "@/lib/attendance-sync/time";

function blankMosqueAttendanceEntry(
  employeeId: string,
  date: string,
): Omit<MosqueAttendanceDoc, "$id" | "$createdAt" | "$updatedAt"> {
  return {
    employeeId,
    date,
    fathisSignInTime: null,
    mendhuruSignInTime: null,
    asuruSignInTime: null,
    maqribSignInTime: null,
    ishaSignInTime: null,
    fathisMinutesLate: 0,
    mendhuruMinutesLate: 0,
    asuruMinutesLate: 0,
    maqribMinutesLate: 0,
    ishaMinutesLate: 0,
    leaveType: null,
    previousLeaveType: null,
    leaveDeducted: false,
    changed: false,
    automation: {
      version: 1,
      lastReconciledAt: null,
      manualOverridePrayers: [],
      prayerPunchRefs: {},
    },
  };
}

function deterministicDocId(date: string, employeeId: string): string {
  return `${date}_${employeeId}`;
}

export async function ensureMosqueAttendanceSheets(
  date: string,
  options: { preview?: boolean } = {},
): Promise<EnsureResult> {
  assertIsoDate(date);
  const preview = options.preview ?? !isAttendanceSyncAutoWriteEnabled();
  const employees = await fetchAllEmployees();
  const eligible = listSyncEligibleEmployees(employees, date);

  const db = getFirestoreDb();
  const existingSnap = await db
    .collection(COLLECTIONS.mosqueAttendance)
    .where("date", "==", date)
    .get();
  const existingRows = fromFirestoreDocs<MosqueAttendanceDoc>(existingSnap.docs);

  const rowsByEmployee = new Map<string, MosqueAttendanceDoc[]>();
  for (const row of existingRows) {
    const list = rowsByEmployee.get(row.employeeId) ?? [];
    list.push(row);
    rowsByEmployee.set(row.employeeId, list);
  }

  const conflicts: EnsureResult["conflicts"] = [];
  let created = 0;
  let reused = 0;
  let skipped = 0;

  for (const { employee } of eligible) {
    const rows = rowsByEmployee.get(employee.$id) ?? [];
    if (rows.length > 1) {
      conflicts.push({
        employeeId: employee.$id,
        rowIds: rows.map((row) => row.$id),
      });
      continue;
    }

    if (rows.length === 1) {
      reused += 1;
      continue;
    }

    if (preview) {
      created += 1;
      continue;
    }

    const docId = deterministicDocId(date, employee.$id);
    const ref = db.collection(COLLECTIONS.mosqueAttendance).doc(docId);

    const wrote = await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return false;

      tx.set(
        ref,
        withTimestamps(blankMosqueAttendanceEntry(employee.$id, date) as Record<string, unknown>, true),
      );
      return true;
    });

    if (wrote) created += 1;
    else skipped += 1;
  }

  return {
    date,
    created,
    reused,
    skipped,
    conflicts,
    preview,
  };
}

export async function ensureMissingDates(
  fromDate: string,
  toDate: string,
  options: { preview?: boolean } = {},
): Promise<EnsureResult[]> {
  const { enumerateIsoDates } = await import("@/lib/attendance-sync/time");
  const dates = enumerateIsoDates(fromDate, toDate);
  const results: EnsureResult[] = [];
  for (const date of dates) {
    results.push(await ensureMosqueAttendanceSheets(date, options));
  }
  return results;
}

export function findDuplicateRowsForDate(
  rows: MosqueAttendanceDoc[],
): EnsureResult["conflicts"] {
  const byEmployee = new Map<string, string[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row.$id);
    byEmployee.set(row.employeeId, list);
  }

  return Array.from(byEmployee.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([employeeId, rowIds]) => ({ employeeId, rowIds }));
}
