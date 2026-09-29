"use server";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
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

export type AnnualLeaveRequest = LeaveRequest & AnnualLeaveFormValues & {
  employeeId: string;
  submittedBy: string;
  approvedAt?: string;
  signatureReady?: boolean;
  permanentAddressDv?: string;
  familyLeaveBalance?: number;
  joinedDate?: string;
};

export type AnnualLeaveEmployeeOption = {
  employeeId: string;
  name: string;
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

export async function listAnnualLeaveEmployeeOptions(): Promise<AnnualLeaveEmployeeOption[]> {
  if (!(await getSessionAuthProfile()) && !getEmployeeProfileSessionId()) throw new Error("Unauthorized");
  const employees = await fetchAllEmployees();
  return employees.map((employee) => ({ employeeId: employee.$id, name: employee.name }))
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
  const now = new Date();
  const submittedDate = maldivesDateTime(now).date;
  const raw = employee as typeof employee & Record<string, unknown>;
  const idCardNumber = [raw.idCardNumber, raw.idCard, raw.nationalId, raw.nationalIdCard]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const request: Omit<AnnualLeaveRequest, "$id" | "$createdAt" | "$updatedAt"> = {
    fullName: employee.name,
    leaveType: "Annual Leave",
    reason,
    totalDays: range.durationDays,
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
  await requireAdmin();
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
    await requestRef.update({
      approver: person,
      approvalStatus: "Pending",
      approvedAt: FieldValue.delete(),
      signatureReady: false,
    });
  } else {
    await requestRef.update({ collector: person });
  }
}

export async function approveAnnualLeaveRequest(requestId: string): Promise<void> {
  await requireAdmin();
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
      if (request.leaveBalance == null && typeof employee.annualLeave === "number") details.leaveBalance = employee.annualLeave;
      if (request.familyLeaveBalance == null && typeof employee.familyRelatedLeave === "number") details.familyLeaveBalance = employee.familyRelatedLeave;
    }
  }
  const approvedAt = new Date().toISOString();
  await createAnnualLeaveChitPdf({ ...request, ...details, approvalStatus: "Approved", approvedAt });
  await ref.update({
    ...details,
    approvalStatus: "Approved",
    approvedAt,
    signatureReady: true,
  });
}

export async function deleteAnnualLeaveRequest(requestId: string): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  await getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(requestId).delete();
}
