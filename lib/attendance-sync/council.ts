import { fromFirestoreDoc, withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees, fetchAttendanceForDate, fetchHolidayCalendar } from "@/lib/firebase/hr";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";
import { computeCouncilMinutesLate } from "@/lib/attendance/council-lateness";
import { buildSourceEmployeeMaps, listCouncilEmployees, type SyncEligibleEmployee } from "@/lib/attendance-sync/employee-sync";
import { listEligiblePunchesForEmployeeDate } from "@/lib/attendance-sync/punch-store";
import { isAttendanceSyncAutoWriteEnabled } from "@/lib/attendance-sync/runtime";
import { assertIsoDate, todayMaldivesIso, utcToMaldivesParts } from "@/lib/attendance-sync/time";
import type { AttendancePunchDoc, EnsureResult } from "@/lib/attendance-sync/types";

type StoredPunch = AttendancePunchDoc & { $id: string };

export function selectCouncilFirstPunch(date: string, punches: StoredPunch[]): StoredPunch | null {
  return punches
    .filter((punch) => {
      if (!punch.eligible || punch.voidedAt) return false;
      const parts = utcToMaldivesParts(punch.timestampUtc);
      return parts.localDate === date && parts.localMinutes >= 6 * 60 &&
        parts.localMinutes < 9 * 60;
    })
    .sort((a, b) =>
      a.timestampUtc.localeCompare(b.timestampUtc) ||
      (a.source === b.source ? a.$id.localeCompare(b.$id) : a.source === "zkteco" ? -1 : 1),
    )[0] ?? null;
}

export function canAutomateCouncilRow(row: Pick<AttendanceDoc, "leaveType" | "signInTime" | "automation">): boolean {
  if (row.leaveType?.trim() || row.automation?.manualOverride) return false;
  return Boolean(row.automation || !row.signInTime);
}

export function isCouncilPunchFromEnabledSource(punch: StoredPunch, entry: SyncEligibleEmployee): boolean {
  if (punch.source === "etime") {
    return Boolean(entry.config.etime?.enabled &&
      punch.sourceEmployeeId === entry.config.etime.employeeCode.trim());
  }
  const zkId = entry.config.zkteco?.enabled
    ? entry.config.zkteco.userId.trim()
    : entry.config.zkteco?.enabled === false
      ? null
      : entry.employee.deviceUserId?.trim();
  return Boolean(zkId && punch.sourceEmployeeId === zkId);
}

/** Council staff are off on Fridays, Saturdays and holiday-calendar dates. */
async function isCouncilWorkday(date: string): Promise<boolean> {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (day === 5 || day === 6) return false;
  const calendar = await fetchHolidayCalendar(date.slice(0, 7));
  return !(calendar?.holidayDates ?? []).includes(date);
}

/**
 * Sign-in recorded for an employee with a fixed time (set on their record,
 * e.g. 08:00 for staff who work away from the machine), or null to use punches.
 */
export function fixedSignInIso(employee: EmployeeDoc, date: string): string | null {
  const time = employee.fixedSignInTime?.trim() ?? "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return new Date(`${date}T${time}:00.000+05:00`).toISOString();
}

export function blankEntry(employeeId: string, date: string): Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt"> {
  return {
    employeeId,
    date,
    signInTime: null,
    minutesLate: 0,
    leaveType: null,
    previousLeaveType: null,
    leaveDeducted: false,
    automation: { version: 1, lastReconciledAt: null, manualOverride: false, punchRef: null },
  };
}

export async function ensureCouncilAttendanceSheets(
  date: string,
  options: { preview?: boolean } = {},
): Promise<EnsureResult> {
  assertIsoDate(date);
  const preview = options.preview ?? !isAttendanceSyncAutoWriteEnabled();
  const [employees, rows] = await Promise.all([fetchAllEmployees(), fetchAttendanceForDate(date)]);
  const rowsByEmployee = new Map<string, AttendanceDoc[]>();
  for (const row of rows) {
    const group = rowsByEmployee.get(row.employeeId) ?? [];
    group.push(row);
    rowsByEmployee.set(row.employeeId, group);
  }

  const result: EnsureResult = { date, created: 0, reused: 0, skipped: 0, conflicts: [], preview };
  const db = getFirestoreDb();
  const councilEmployees = listCouncilEmployees(employees);
  const workday = councilEmployees.some((employee) => fixedSignInIso(employee, date))
    ? await isCouncilWorkday(date)
    : false;
  for (const employee of councilEmployees) {
    const group = rowsByEmployee.get(employee.$id) ?? [];
    if (group.length > 1) {
      result.conflicts.push({ employeeId: employee.$id, rowIds: group.map((row) => row.$id) });
      continue;
    }
    if (group.length === 1) {
      result.reused++;
      continue;
    }
    if (preview) {
      result.created++;
      continue;
    }
    const ref = db.collection(COLLECTIONS.attendance).doc(`${date}_${employee.$id}`);
    const wrote = await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return false;
      const fixed = workday ? fixedSignInIso(employee, date) : null;
      tx.set(ref, withTimestamps({
        ...blankEntry(employee.$id, date),
        ...(fixed ? { signInTime: fixed, minutesLate: computeCouncilMinutesLate(fixed, date) } : {}),
      }, true));
      return true;
    });
    if (wrote) result.created++;
    else result.skipped++;
  }
  return result;
}

export type CouncilReconcileResult = {
  date: string;
  updated: number;
  conflicts: Array<{ employeeId: string; rowIds: string[] }>;
  preview: boolean;
};

export async function reconcileCouncilAttendanceDate(
  date: string,
  options: { preview?: boolean; ensureToday?: boolean; employeeIds?: string[] } = {},
): Promise<CouncilReconcileResult> {
  assertIsoDate(date);
  const preview = options.preview ?? !isAttendanceSyncAutoWriteEnabled();
  if (options.ensureToday && date === todayMaldivesIso()) {
    await ensureCouncilAttendanceSheets(date, { preview });
  }
  const [employees, rows] = await Promise.all([fetchAllEmployees(), fetchAttendanceForDate(date)]);
  const councilIds = new Set(listCouncilEmployees(employees).map((employee) => employee.$id));
  const mappings = buildSourceEmployeeMaps(employees, date);
  const entryById = new Map(
    Array.from(mappings.byEmployeeId.values())
      .filter(({ employee }) => councilIds.has(employee.$id))
      .map((entry) => [entry.employee.$id, entry]),
  );
  // Staff with a fixed sign-in often have no machine ID, so add them here.
  for (const employee of listCouncilEmployees(employees)) {
    if (!entryById.has(employee.$id) && fixedSignInIso(employee, date)) {
      entryById.set(employee.$id, { employee, config: { enabled: true, effectiveFrom: "2020-01-01" } });
    }
  }
  const groups = new Map<string, AttendanceDoc[]>();
  const onlyIds = options.employeeIds?.length ? new Set(options.employeeIds) : null;
  for (const row of rows) {
    if (!entryById.has(row.employeeId)) continue;
    if (onlyIds && !onlyIds.has(row.employeeId)) continue;
    const group = groups.get(row.employeeId) ?? [];
    group.push(row);
    groups.set(row.employeeId, group);
  }
  const conflicts: CouncilReconcileResult["conflicts"] = [];
  let updated = 0;
  const db = getFirestoreDb();
  const workday = Array.from(groups.keys()).some((id) => fixedSignInIso(entryById.get(id)!.employee, date))
    ? await isCouncilWorkday(date)
    : false;

  for (const [employeeId, group] of groups) {
    if (group.length > 1) {
      conflicts.push({ employeeId, rowIds: group.map((row) => row.$id) });
      continue;
    }
    const row = group[0]!;
    const entry = entryById.get(employeeId)!;
    const employee = entry.employee;
    if (!canAutomateCouncilRow(row)) continue;
    // A fixed sign-in replaces punches on workdays.
    const fixed = workday ? fixedSignInIso(employee, date) : null;
    const punches = fixed ? [] : await listEligiblePunchesForEmployeeDate(employeeId, date, {
      zkUserId: employee.deviceUserId ?? employee.attendanceSync?.zkteco?.userId,
      etimeCode: employee.attendanceSync?.etime?.employeeCode,
    });
    const selected = selectCouncilFirstPunch(date,
      punches.filter((punch) =>
        !(punch.source === "zkteco"
          ? mappings.duplicateZkIds
          : mappings.duplicateEtimeCodes).includes(punch.sourceEmployeeId) &&
        isCouncilPunchFromEnabledSource(punch, entry)));
    const signInTime = fixed ?? selected?.timestampUtc ?? null;
    const minutesLate = signInTime
      ? computeCouncilMinutesLate(signInTime, date)
      : 0;
    const oldRef = row.automation?.punchRef;
    if (row.signInTime === signInTime && row.minutesLate === minutesLate &&
        (oldRef?.punchLogId ?? null) === (selected?.$id ?? null)) continue;
    if (preview) {
      updated++;
      continue;
    }

    const ref = db.collection(COLLECTIONS.attendance).doc(row.$id);
    const wrote = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const fresh = snap.data() as AttendanceDoc;
      if (!canAutomateCouncilRow(fresh)) return false;
      if (fresh.signInTime !== row.signInTime) return false;
      tx.set(ref, withTimestamps({
        signInTime,
        minutesLate,
        automation: {
          version: 1,
          lastReconciledAt: new Date().toISOString(),
          manualOverride: false,
          punchRef: selected
            ? { punchLogId: selected.$id, source: selected.source, timestampUtc: selected.timestampUtc }
            : null,
        },
      }), { merge: true });
      return true;
    });
    if (wrote) updated++;
  }
  return { date, updated, conflicts, preview };
}

export async function resumeCouncilAttendanceAutomation(attendanceId: string): Promise<AttendanceDoc | null> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.attendance).doc(attendanceId);
  const date = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const row = snap.data() as AttendanceDoc;
    if (!row.automation?.manualOverride) return row.date;
    tx.set(ref, withTimestamps({ automation: { ...row.automation, manualOverride: false } }),
      { merge: true });
    return row.date;
  });
  if (!date) return null;
  await reconcileCouncilAttendanceDate(date, { preview: false });
  const snap = await ref.get();
  return fromFirestoreDoc<AttendanceDoc>(snap);
}
