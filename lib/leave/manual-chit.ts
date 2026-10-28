import "server-only";

import type { AnnualLeaveRequest } from "@/lib/actions/annual-leave.actions";
import { fetchEmployeeById } from "@/lib/firebase/hr";
import type { EmployeeDoc } from "@/lib/firebase/types";
import { createAnnualLeaveChitPdf } from "@/lib/forms/annual-leave-chit";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { leaveDatesFor } from "@/lib/leave/approved-leave-attendance";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";

/** What the Admin page shows before HR makes a chit by hand. */
export type ManualChitPreview = {
  /** Working days in the range: council staff skip weekends and public holidays. */
  days: number;
  /** Annual leave balance on the employee's record now. */
  balance: number | null;
  familyBalance: number | null;
  /** Dhivehi details missing from the record, which leave blanks on the chit. */
  missing: string[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function missingDetails(employee: EmployeeDoc): string[] {
  const raw = employee as EmployeeDoc & Record<string, unknown>;
  return [
    !text(raw.nameDv) ? "Dhivehi name" : null,
    !text(raw.addressDv) ? "Dhivehi address" : null,
    !text(raw.designationDv) ? "Dhivehi designation" : null,
  ].filter((value): value is string => value !== null);
}

export async function previewManualChit(employeeId: string, startDate: string, endDate: string): Promise<ManualChitPreview> {
  const range = parseLeaveDateRange(startDate, endDate);
  const employee = await fetchEmployeeById(employeeId);
  const days = (await leaveDatesFor(employee, range.startDate, range.endDate)).length;
  return {
    days,
    balance: numberOrNull(employee.annualLeave),
    familyBalance: numberOrNull(employee.familyRelatedLeave),
    missing: missingDetails(employee),
  };
}

/**
 * An annual leave chit made by HR without a request in the app, filled from
 * the employee's record. Nothing is saved and no leave is deducted.
 */
export async function buildManualChit(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  approverEmployeeId: string;
  reason: string;
  balanceAfter?: number;
}): Promise<{ bytes: Uint8Array; fileName: string }> {
  const range = parseLeaveDateRange(input.startDate, input.endDate);
  const supervisor = LEAVE_SUPERVISORS.find((item) => item.employeeId === input.approverEmployeeId);
  if (!supervisor) throw new Error("Choose one of the four approved supervisors");
  const [employee, approver] = await Promise.all([
    fetchEmployeeById(input.employeeId),
    fetchEmployeeById(supervisor.employeeId),
  ]);
  const days = (await leaveDatesFor(employee, range.startDate, range.endDate)).length;
  if (days === 0) throw new Error("The selected dates have no working days");

  const raw = employee as EmployeeDoc & Record<string, unknown>;
  const approverRaw = approver as EmployeeDoc & Record<string, unknown>;
  const now = new Date();
  const idCardNumber = [raw.idCardNumber, raw.idCard, raw.nationalId, raw.nationalIdCard].map(text).find(Boolean) ?? "";
  const request = {
    $id: "manual",
    employeeId: employee.$id,
    fullName: employee.name,
    leaveType: "annualLeave",
    approvalStatus: "Approved",
    approvedAt: now.toISOString(),
    createdAt: now.toISOString(),
    submittedBy: "",
    submittedDate: maldivesDateTime(now).date,
    employeeNameDv: text(raw.nameDv) || employee.name,
    addressDv: text(raw.addressDv) || text(employee.address),
    permanentAddressDv: text(raw.permanentAddressDv) || text(raw.permanentAddress) || text(raw.addressDv) || text(employee.address),
    designationDv: text(raw.designationDv) || text(employee.designation),
    recordCardNumber: text(employee.recordCardNumber),
    idCardNumber,
    joinedDate: text(employee.joinedDate),
    reason: input.reason.trim(),
    totalDays: days,
    startDate: range.startDate,
    endDate: range.endDate,
    leaveBalance: numberOrNull(employee.annualLeave) ?? undefined,
    familyLeaveBalance: numberOrNull(employee.familyRelatedLeave) ?? undefined,
    approver: {
      employeeId: approver.$id,
      name: approver.name,
      nameDv: text(approverRaw.nameDv) || approver.name,
      designationDv: text(approverRaw.designationDv) || text(approver.designation),
      sectionDv: text(approverRaw.sectionDv) || text(approver.section),
      assignedDate: maldivesDateTime(now).date,
    },
  } as unknown as AnnualLeaveRequest;

  const bytes = await createAnnualLeaveChitPdf(request, { balanceAfter: input.balanceAfter });
  const safeName = employee.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "employee";
  return { bytes, fileName: `Annual-Leave-Chit-${safeName}-${range.startDate}.pdf` };
}
