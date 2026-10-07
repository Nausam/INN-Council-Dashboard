import "server-only";

import { fromFirestoreDoc, fromFirestoreDocs, withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import {
  fetchEmployeeById,
  fetchHolidayCalendar,
  submitCouncilAttendanceUpdates,
  submitMosqueLeaveUpdates,
} from "@/lib/firebase/hr";
import type { AttendanceDoc, EmployeeDoc, MosqueAttendanceDoc } from "@/lib/firebase/types";
import { blankEntry, reconcileCouncilAttendanceDate } from "@/lib/attendance-sync/council";
import { reconcileMosqueAttendanceDate } from "@/lib/attendance-sync/reconcile";
import { blankMosqueAttendanceEntry } from "@/lib/attendance-sync/ensure-sheets";
import { enumerateIsoDates, todayMaldivesIso } from "@/lib/attendance-sync/time";
import { LEAVE_TOTAL_ALLOWANCE } from "@/lib/employees/leave-usage";

/** What an approval wrote to attendance, stored on the request so it can be undone. */
export type AppliedLeaveAttendance = {
  leaveType: string;
  collection: typeof COLLECTIONS.attendance | typeof COLLECTIONS.mosqueAttendance;
  dates: string[];
  appliedAt: string;
};

/** A reason the leave can't be applied that the admin should see as-is. */
export class LeaveAttendanceError extends Error {}

/** Server-action errors are hidden in production, so approvals return these messages instead. */
export function leaveAttendanceFailure(error: unknown): { ok: false; message: string } {
  if (error instanceof LeaveAttendanceError) return { ok: false, message: error.message };
  throw error;
}

const LEAVE_LABELS: Record<string, string> = {
  annualLeave: "Annual Leave",
  familyRelatedLeave: "Family Related Leave",
  sickLeave: "Sick Leave",
};

function isMosqueEmployee(employee: EmployeeDoc): boolean {
  return employee.section?.trim().toLowerCase() === "mosque";
}

/** Council staff are off on Fridays, Saturdays and calendar holidays; mosque staff work every day. */
async function leaveDatesFor(employee: EmployeeDoc, startDate: string, endDate: string) {
  const dates = enumerateIsoDates(startDate, endDate);
  if (isMosqueEmployee(employee)) return dates;

  const months = Array.from(new Set(dates.map((date) => date.slice(0, 7))));
  const calendars = await Promise.all(months.map((month) => fetchHolidayCalendar(month)));
  const holidays = new Set(calendars.flatMap((calendar) => calendar?.holidayDates ?? []));
  return dates.filter((date) => {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return day !== 5 && day !== 6 && !holidays.has(date);
  });
}

/** The employee's existing attendance row for each of the given dates. */
async function existingRowsByDate<T extends AttendanceDoc | MosqueAttendanceDoc>(
  collection: AppliedLeaveAttendance["collection"],
  employeeId: string,
  dates: string[],
): Promise<Map<string, T>> {
  const snap = await getFirestoreDb()
    .collection(collection)
    .where("employeeId", "==", employeeId)
    .get();
  const wanted = new Set(dates);
  const byDate = new Map<string, T>();
  for (const row of fromFirestoreDocs<T>(snap.docs)) {
    const date = String(row.date ?? "").slice(0, 10);
    if (wanted.has(date) && !byDate.has(date)) byDate.set(date, row);
  }
  return byDate;
}

/** Creates blank rows for days that have no sheet yet and adds them to `byDate`. */
async function createMissingRows<T extends AttendanceDoc | MosqueAttendanceDoc>(
  collection: AppliedLeaveAttendance["collection"],
  employeeId: string,
  dates: string[],
  byDate: Map<string, T>,
): Promise<void> {
  const db = getFirestoreDb();
  for (const date of dates.filter((value) => !byDate.has(value))) {
    const id = `${date}_${employeeId}`;
    const entry = collection === COLLECTIONS.attendance
      ? blankEntry(employeeId, date)
      : blankMosqueAttendanceEntry(employeeId, date);
    const ref = db.collection(collection).doc(id);
    try {
      await ref.create(withTimestamps(entry, true));
      byDate.set(date, { ...entry, $id: id } as unknown as T);
    } catch {
      // The sheet for this day was created in the meantime; use it.
      const existing = fromFirestoreDoc<T>(await ref.get());
      if (!existing) throw new Error(`Could not prepare attendance for ${date}`);
      byDate.set(date, existing);
    }
  }
}

async function setLeaveOnRows(
  employee: EmployeeDoc,
  collection: AppliedLeaveAttendance["collection"],
  rows: Array<AttendanceDoc | MosqueAttendanceDoc>,
  leaveType: string | null,
) {
  if (rows.length === 0) return;
  if (collection === COLLECTIONS.mosqueAttendance) {
    await submitMosqueLeaveUpdates(
      employee.$id,
      rows.map((row) => ({ attendanceId: row.$id, leaveType })),
    );
    return;
  }
  await submitCouncilAttendanceUpdates(
    (rows as AttendanceDoc[]).map((row) => ({
      attendanceId: row.$id,
      employeeId: employee.$id,
      employeeName: employee.name,
      signInTime: leaveType ? null : row.signInTime,
      leaveType,
      minutesLate: leaveType ? 0 : row.minutesLate ?? 0,
      previousLeaveType: row.leaveType ?? null,
      leaveDeducted: row.leaveDeducted ?? Boolean(row.leaveType),
    })),
  );
}

type LeaveRequestInput = {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
};

/** Works out which days an approval would mark, without writing anything. */
export async function planApprovedLeave(input: LeaveRequestInput) {
  const employee = await fetchEmployeeById(input.employeeId);
  const collection = isMosqueEmployee(employee)
    ? COLLECTIONS.mosqueAttendance
    : COLLECTIONS.attendance;
  const dates = await leaveDatesFor(employee, input.startDate, input.endDate);
  const rows = await existingRowsByDate<AttendanceDoc | MosqueAttendanceDoc>(
    collection,
    employee.$id,
    dates,
  );
  const datesToMark = dates.filter((date) => rows.get(date)?.leaveType !== input.leaveType);
  return { employee, collection, dates, rows, datesToMark };
}

/**
 * Marks every working day of an approved request with its leave type and
 * deducts (or, for additive leave, adds) one day per marked day. Days already
 * carrying this leave type are left alone, so approving twice never double
 * deducts.
 */
export async function applyApprovedLeaveToAttendance(
  input: LeaveRequestInput,
): Promise<AppliedLeaveAttendance> {
  const { employee, collection, dates, rows, datesToMark } = await planApprovedLeave(input);
  if (dates.length === 0) {
    throw new LeaveAttendanceError("This leave range has no working days to mark");
  }

  // Balance leaves (Annual, Sick, Family Related) can't go below zero.
  if (LEAVE_TOTAL_ALLOWANCE[input.leaveType] !== undefined) {
    const raw = employee[input.leaveType as keyof EmployeeDoc];
    const available = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (datesToMark.length > available) {
      const label = LEAVE_LABELS[input.leaveType] ?? input.leaveType;
      throw new LeaveAttendanceError(
        `${employee.name} has ${available} ${label} day${available === 1 ? "" : "s"} left, but this request needs ${datesToMark.length}.`,
      );
    }
  }

  await createMissingRows(collection, employee.$id, datesToMark, rows);
  await setLeaveOnRows(
    employee,
    collection,
    datesToMark.map((date) => rows.get(date)!),
    input.leaveType,
  );
  return { leaveType: input.leaveType, collection, dates, appliedAt: new Date().toISOString() };
}

/**
 * Clears the leave an approval marked, returns the days to the balance and
 * re-reads the fingerprint punches so those days get their sign-ins back.
 * Days an admin has since changed to something else are left as they are.
 */
export async function revertApprovedLeaveFromAttendance(
  employeeId: string,
  applied: AppliedLeaveAttendance | undefined,
): Promise<void> {
  if (!applied || applied.dates.length === 0) return;
  const employee = await fetchEmployeeById(employeeId);
  const db = getFirestoreDb();
  const snap = await db.collection(applied.collection).where("employeeId", "==", employeeId).get();
  const dates = new Set(applied.dates);
  const rows = fromFirestoreDocs<AttendanceDoc | MosqueAttendanceDoc>(snap.docs).filter(
    (row) => dates.has(String(row.date ?? "").slice(0, 10)) && row.leaveType === applied.leaveType,
  );
  await setLeaveOnRows(employee, applied.collection, rows, null);

  const today = todayMaldivesIso();
  const pastDates = Array.from(new Set(rows.map((row) => String(row.date).slice(0, 10))))
    .filter((date) => date <= today)
    .sort();
  for (const date of pastDates) {
    if (applied.collection === COLLECTIONS.mosqueAttendance) {
      await reconcileMosqueAttendanceDate(date, [employeeId], { preview: false });
    } else {
      await reconcileCouncilAttendanceDate(date, { preview: false, employeeIds: [employeeId] });
    }
  }
}
