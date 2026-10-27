import "server-only";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchEmployeeById } from "@/lib/firebase/hr";
import type { EmployeeDoc } from "@/lib/firebase/types";
import {
  leaveDatesFor,
  realignApprovedLeave,
  type AppliedLeaveAttendance,
} from "@/lib/leave/approved-leave-attendance";

/** One leave request the new holidays changed, for the admin's summary. */
export type HolidayLeaveAdjustment = {
  employeeName: string;
  kind: "Annual leave" | "Leave form";
  status: "Pending" | "Approved";
  /** Annual leave: working days before and after. */
  daysBefore?: number;
  daysAfter?: number;
  /** Approved leave: days unmarked (now holidays) and marked (no longer holidays). */
  removed: string[];
  added: string[];
  problem?: string;
};

function isoSlice(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

/**
 * Re-counts the leave requests overlapping `month` after its public holidays
 * were saved, so a holiday inside a request's dates isn't spent as leave:
 * pending annual leave gets its working-day total updated, and approved
 * leave has its marked attendance days and balance brought in line.
 */
export async function adjustLeaveForHolidays(month: string): Promise<HolidayLeaveAdjustment[]> {
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEnd = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;

  const db = getFirestoreDb();
  const [annualSnap, familySnap] = await Promise.all([
    db.collection(COLLECTIONS.annualLeaveRequests).where("endDate", ">=", monthStart).get(),
    db.collection(COLLECTIONS.familyLeaveRequests).where("leaveEndDate", ">=", monthStart).get(),
  ]);

  const employees = new Map<string, Promise<EmployeeDoc | null>>();
  const employeeFor = (id: string) => {
    if (!employees.has(id)) employees.set(id, fetchEmployeeById(id).catch(() => null));
    return employees.get(id)!;
  };

  const adjustments: HolidayLeaveAdjustment[] = [];
  const requests = [
    ...annualSnap.docs.map((doc) => ({ doc, annual: true })),
    ...familySnap.docs.map((doc) => ({ doc, annual: false })),
  ];
  // One at a time: two requests of one employee share their balance.
  for (const { doc, annual } of requests) {
    const data = doc.data();
    const status = data.approvalStatus === "Approved" ? "Approved" : data.approvalStatus === "Rejected" ? "Rejected" : "Pending";
    if (status === "Rejected") continue;
    const startDate = isoSlice(annual ? data.startDate : data.leaveStartDate || data.requestDate);
    const endDate = isoSlice(annual ? data.endDate : data.leaveEndDate) || startDate;
    if (!startDate || startDate > monthEnd || endDate < monthStart) continue;
    const employeeId = typeof data.employeeId === "string" ? data.employeeId : "";
    const employee = employeeId ? await employeeFor(employeeId) : null;
    if (!employee) continue;

    const days = (await leaveDatesFor(employee, startDate, endDate)).length;
    const daysBefore = annual && typeof data.totalDays === "number" ? data.totalDays : undefined;
    const update: Record<string, unknown> = {};
    const adjustment: HolidayLeaveAdjustment = {
      employeeName: String(data.fullName || data.employeeName || employee.name),
      kind: annual ? "Annual leave" : "Leave form",
      status,
      removed: [],
      added: [],
    };

    // Leave forms (Salaam, Family) count calendar days on the form, so only annual leave's total changes.
    if (annual && days > 0 && daysBefore !== days) {
      update.totalDays = days;
      adjustment.daysBefore = daysBefore;
      adjustment.daysAfter = days;
    }

    const applied = data.attendanceLeave as AppliedLeaveAttendance | undefined;
    if (status === "Approved" && applied?.dates?.length) {
      const result = await realignApprovedLeave(employee, applied, startDate, endDate);
      if (result.removed.length || result.added.length) update.attendanceLeave = result.applied;
      adjustment.removed = result.removed;
      adjustment.added = result.added;
      adjustment.problem = result.problem;
    }

    if (Object.keys(update).length) {
      await doc.ref.update(update);
      adjustments.push(adjustment);
    } else if (adjustment.problem) {
      adjustments.push(adjustment);
    }
  }
  return adjustments;
}
