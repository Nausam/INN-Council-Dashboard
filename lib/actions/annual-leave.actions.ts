"use server";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requireRequestReviewer } from "@/lib/auth/request-approvers";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees, fetchEmployeeById } from "@/lib/firebase/hr";
import type { LeaveRequest } from "@/lib/firebase/types";
import type { AnnualLeaveFormPerson, AnnualLeaveFormValues } from "@/lib/forms/annual-leave";
import { createAnnualLeaveChitPdf } from "@/lib/forms/annual-leave-chit";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import { annualApproverSignaturePath } from "@/lib/leave/approval-signatures";
import { findAnnualLeaveEmployee } from "@/lib/leave/annual-employee";
import {
  applyApprovedLeaveToAttendance,
  leaveAttendanceFailure,
  leaveDatesFor,
  revertApprovedLeaveFromAttendance,
  type AppliedLeaveAttendance,
} from "@/lib/leave/approved-leave-attendance";

export type AnnualLeaveRequest = LeaveRequest & AnnualLeaveFormValues & {
  employeeId: string;
  submittedBy: string;
  approvedAt?: string;
  rejectedAt?: string;
  signatureReady?: boolean;
  permanentAddressDv?: string;
  familyLeaveBalance?: number;
  joinedDate?: string;
  attendanceLeave?: AppliedLeaveAttendance;
};

export type AnnualLeaveEmployeeOption = {
  employeeId: string;
  name: string;
  nameDv?: string;
};

function personFromEmployee(employee: Awaited<ReturnType<typeof fetchEmployeeById>>, date?: string): AnnualLeaveFormPerson {
  return {
    employeeId: employee.$id,
    name: employee.name,
    nameDv: String(employee.nameDv || employee.name || "").trim(),
    designationDv: String(employee.designationDv || employee.designation || "").trim(),
    sectionDv: String(employee.sectionDv || employee.section || "").trim(),
    ...(date ? { assignedDate: date } : {}),
  };
}

/**
 * Days of annual leave a range spends: council staff skip Fridays, Saturdays
 * and holiday-calendar dates; mosque staff count every day.
 */
async function annualLeaveDays(
  employee: Awaited<ReturnType<typeof fetchEmployeeById>>,
  startDate: string,
  endDate: string,
): Promise<number> {
  const days = (await leaveDatesFor(employee, startDate, endDate)).length;
  if (days === 0) throw new Error("The selected dates have no working days");
  return days;
}

/** The day count shown while the employee picks annual leave dates. */
export async function countAnnualLeaveDays(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const employeeId = String(input.employeeId ?? "").trim();
  if (!(await getSessionAuthProfile()) && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  const range = parseLeaveDateRange(input.startDate, input.endDate);
  const employee = await fetchEmployeeById(employeeId);
  return (await leaveDatesFor(employee, range.startDate, range.endDate)).length;
}

export async function listAnnualLeaveEmployeeOptions(): Promise<AnnualLeaveEmployeeOption[]> {
  if (!(await getSessionAuthProfile()) && !getEmployeeProfileSessionId()) throw new Error("Unauthorized");
  const employees = await fetchAllEmployees();
  return employees.map((employee) => ({
    employeeId: employee.$id,
    name: employee.name,
    ...(employee.nameDv?.trim() ? { nameDv: employee.nameDv.trim() } : {}),
  }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function submitAnnualLeaveRequest(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  takeoverEmployeeId: string;
}): Promise<void> {
  const employeeId = String(input.employeeId ?? "").trim();
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  const takeoverEmployeeId = String(input.takeoverEmployeeId ?? "").trim();
  if (!/^[\w-]{1,128}$/.test(employeeId) || !/^[\w-]{1,128}$/.test(takeoverEmployeeId) || employeeId === takeoverEmployeeId) {
    throw new Error("Select another employee to take over responsibilities");
  }
  const range = parseLeaveDateRange(input.startDate, input.endDate);
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 500) throw new Error("Enter a reason for annual leave (2–500 characters)");
  const [employee, takeoverEmployee] = await Promise.all([
    fetchEmployeeById(employeeId),
    fetchEmployeeById(takeoverEmployeeId),
  ]);
  const totalDays = await annualLeaveDays(employee, range.startDate, range.endDate);
  const now = new Date();
  const submittedDate = maldivesDateTime(now).date;
  const raw = employee as typeof employee & Record<string, unknown>;
  const idCardNumber = [raw.idCardNumber, raw.idCard, raw.nationalId, raw.nationalIdCard]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const request: Omit<AnnualLeaveRequest, "$id" | "$createdAt" | "$updatedAt"> = {
    fullName: employee.name,
    leaveType: "Annual Leave",
    reason,
    totalDays,
    startDate: range.startDate,
    endDate: range.endDate,
    approvalStatus: "Pending",
    createdAt: now.toISOString(),
    employeeId,
    submittedBy: profile?.email || profile?.fullName || employee.name,
    employeeNameDv: String(employee.nameDv || employee.name || "").trim(),
    addressDv: String(employee.addressDv || employee.address || "").trim(),
    permanentAddressDv: String(raw.permanentAddressDv || raw.permanentAddress || employee.addressDv || employee.address || "").trim(),
    designationDv: String(employee.designationDv || employee.designation || "").trim(),
    recordCardNumber: employee.recordCardNumber?.trim() || "",
    idCardNumber: idCardNumber?.trim() || "",
    joinedDate: employee.joinedDate?.trim() || "",
    submittedDate,
    leaveBalance: typeof employee.annualLeave === "number" ? employee.annualLeave : undefined,
    familyLeaveBalance: typeof employee.familyRelatedLeave === "number" ? employee.familyRelatedLeave : undefined,
    takeover: personFromEmployee(takeoverEmployee),
  };
  await getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(randomUUID()).set(request);
}

/**
 * Lets the employee change their own annual leave request while it is still
 * pending. Legacy requests without an employee ID can't be proven to belong
 * to this employee, so they stay read-only.
 */
export async function updateAnnualLeaveRequest(input: {
  employeeId: string;
  requestId: string;
  startDate: string;
  endDate: string;
  reason: string;
  takeoverEmployeeId: string;
}): Promise<{ ok: true } | { ok: false; code: "not_editable" }> {
  const employeeId = String(input.employeeId ?? "").trim();
  const requestId = String(input.requestId ?? "").trim();
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  const takeoverEmployeeId = String(input.takeoverEmployeeId ?? "").trim();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  if (!/^[\w-]{1,128}$/.test(employeeId) || !/^[\w-]{1,128}$/.test(takeoverEmployeeId) || employeeId === takeoverEmployeeId) {
    throw new Error("Select another employee to take over responsibilities");
  }
  const range = parseLeaveDateRange(input.startDate, input.endDate);
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 500) throw new Error("Enter a reason for annual leave (2–500 characters)");
  const [employee, takeoverEmployee] = await Promise.all([
    fetchEmployeeById(employeeId),
    fetchEmployeeById(takeoverEmployeeId),
  ]);
  const totalDays = await annualLeaveDays(employee, range.startDate, range.endDate);

  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.annualLeaveRequests).doc(requestId);
  return db.runTransaction(async (transaction) => {
    const current = (await transaction.get(requestRef)).data() as AnnualLeaveRequest | undefined;
    if (
      !current ||
      current.employeeId !== employeeId ||
      current.approvalStatus === "Approved" ||
      current.approvalStatus === "Rejected"
    ) {
      return { ok: false, code: "not_editable" } as const;
    }
    transaction.update(requestRef, {
      reason,
      totalDays,
      startDate: range.startDate,
      endDate: range.endDate,
      takeover: personFromEmployee(takeoverEmployee),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true } as const;
  });
}

export async function listAnnualLeaveRequests(offset = 0): Promise<{
  requests: AnnualLeaveRequest[];
  totalCount: number;
}> {
  await requireAdmin();
  const collection = getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests);
  const [snapshot, count] = await Promise.all([
    collection.orderBy("createdAt", "desc").offset(Math.max(0, offset)).limit(12).get(),
    collection.count().get(),
  ]);
  return {
    requests: snapshot.docs.map((doc) => ({ ...(doc.data() as AnnualLeaveRequest), $id: doc.id })),
    totalCount: count.data().count,
  };
}

export async function assignAnnualLeavePerson(
  requestId: string,
  role: "approver" | "collector",
  employeeId: string,
): Promise<void> {
  // Approvers in the Employee Profile app choose who signs; collectors stay admin-only.
  if (role === "approver") await requireRequestReviewer();
  else await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId) || !/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid request or employee");
  if (role !== "approver" && role !== "collector") throw new Error("Invalid role");
  if (role === "approver" && !annualApproverSignaturePath(employeeId)) {
    throw new Error("Choose one of the four approved supervisors");
  }
  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.annualLeaveRequests).doc(requestId);
  const [request, employee] = await Promise.all([requestRef.get(), fetchEmployeeById(employeeId)]);
  if (!request.exists) throw new Error("Annual leave request not found");
  const person = personFromEmployee(employee, maldivesDateTime().date);
  if (role === "approver") {
    // Changing the approver sends the request back to Pending, so undo its leave days.
    const current = request.data() as AnnualLeaveRequest;
    await revertApprovedLeaveFromAttendance(current.employeeId, current.attendanceLeave);
    await requestRef.update({
      approver: person,
      approvalStatus: "Pending",
      approvedAt: FieldValue.delete(),
      rejectedAt: FieldValue.delete(),
      signatureReady: false,
      attendanceLeave: FieldValue.delete(),
    });
  } else {
    await requestRef.update({ collector: person });
  }
}

export async function approveAnnualLeaveRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reviewer = await requireRequestReviewer();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.annualLeaveRequests).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Annual leave request not found");
  const request = snap.data() as AnnualLeaveRequest;
  if (!request.approver) throw new Error("Select the approving supervisor first");
  const signaturePath = annualApproverSignaturePath(request.approver.employeeId);
  if (!signaturePath) throw new Error("This employee cannot approve annual leave");
  const details: Partial<AnnualLeaveRequest> = {};
  const employee = await findAnnualLeaveEmployee(request);
  if (employee) {
    if (!request.joinedDate && employee.joinedDate) details.joinedDate = employee.joinedDate.trim();
    if (!request.employeeId) {
      const raw = employee as typeof employee & Record<string, unknown>;
      const idCardNumber = [raw.idCardNumber, raw.idCard, raw.nationalId, raw.nationalIdCard]
        .find((value) => typeof value === "string" && value.trim()) as string | undefined;
      details.employeeId = employee.$id;
      details.employeeNameDv = request.employeeNameDv || String(employee.nameDv || employee.name || "").trim();
      details.addressDv = request.addressDv || String(employee.addressDv || employee.address || "").trim();
      details.permanentAddressDv = request.permanentAddressDv || String(raw.permanentAddressDv || raw.permanentAddress || employee.addressDv || employee.address || "").trim();
      details.designationDv = request.designationDv || String(employee.designationDv || employee.designation || "").trim();
      details.recordCardNumber = request.recordCardNumber || employee.recordCardNumber?.trim() || "";
      details.idCardNumber = request.idCardNumber || idCardNumber?.trim() || "";
      if (request.familyLeaveBalance == null && typeof employee.familyRelatedLeave === "number") details.familyLeaveBalance = employee.familyRelatedLeave;
    }
  }
  // The chit shows the balance left after this leave, worked out from the
  // balance just before it is deducted (other leave may have changed it since
  // the request was made).
  if (typeof employee?.annualLeave === "number") details.leaveBalance = employee.annualLeave;
  const employeeId = request.employeeId || details.employeeId;
  if (!employeeId) throw new Error("Could not match this request to an employee record");
  const approvedAt = new Date().toISOString();
  await createAnnualLeaveChitPdf({ ...request, ...details, approvalStatus: "Approved", approvedAt });
  let attendanceLeave;
  try {
    attendanceLeave = await applyApprovedLeaveToAttendance({
      employeeId,
      leaveType: "annualLeave",
      startDate: String(request.startDate).slice(0, 10),
      endDate: String(request.endDate || request.startDate).slice(0, 10),
    });
  } catch (error) {
    return leaveAttendanceFailure(error);
  }
  await ref.update({
    ...details,
    approvalStatus: "Approved",
    approvedAt,
    rejectedAt: FieldValue.delete(),
    signatureReady: true,
    attendanceLeave,
    actionBy: reviewer.name,
  });
  return { ok: true };
}

/** Declines an annual leave request, undoing its leave days if it had been approved. */
export async function rejectAnnualLeaveRequest(requestId: string): Promise<void> {
  const reviewer = await requireRequestReviewer();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const ref = getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Annual leave request not found");
  const request = snap.data() as AnnualLeaveRequest;
  await revertApprovedLeaveFromAttendance(request.employeeId, request.attendanceLeave);
  await ref.update({
    approvalStatus: "Rejected",
    rejectedAt: new Date().toISOString(),
    approvedAt: FieldValue.delete(),
    signatureReady: false,
    attendanceLeave: FieldValue.delete(),
    actionBy: reviewer.name,
  });
}

export async function deleteAnnualLeaveRequest(requestId: string): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const ref = getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(requestId);
  const request = (await ref.get()).data() as AnnualLeaveRequest | undefined;
  if (request) await revertApprovedLeaveFromAttendance(request.employeeId, request.attendanceLeave);
  await ref.delete();
}
