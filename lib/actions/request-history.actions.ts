"use server";

import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchEmployeeById } from "@/lib/firebase/hr";
import type { FamilyLeaveRequestSummary } from "@/lib/actions/family-leave.actions";
import type { AnnualLeaveRequest } from "@/lib/actions/annual-leave.actions";
import type { OvertimeRequest } from "@/lib/firebase/types";

export type RequestHistoryKind = "salaam" | "family" | "annual" | "ot";
export type RequestHistoryStatus = "Pending" | "Approved" | "Rejected";

export type RequestHistoryEntry = {
  id: string;
  kind: RequestHistoryKind;
  status: RequestHistoryStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  reason?: string;
  chitAvailable?: boolean;
  /** True while the employee may still change the request (pending and theirs). */
  editable?: boolean;
  startTime?: string;
  endTime?: string;
  takeoverEmployeeId?: string;
};

function statusOf(value: unknown): RequestHistoryStatus {
  return value === "Approved" || value === "Rejected" ? value : "Pending";
}

function isoDateTime(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}

export async function listEmployeeRequestHistory(employeeId: string): Promise<RequestHistoryEntry[]> {
  if (!(await getSessionAuthProfile()) && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  const db = getFirestoreDb();
  const employee = await fetchEmployeeById(employeeId);
  const [familySnap, annualSnap, overtimeSnap, sameNameSnap] = await Promise.all([
    db.collection(COLLECTIONS.familyLeaveRequests).where("employeeId", "==", employeeId).get(),
    db.collection(COLLECTIONS.annualLeaveRequests).where("employeeId", "==", employeeId).get(),
    db.collection(COLLECTIONS.overtimeRequests).get(),
    db.collection(COLLECTIONS.employees).where("name", "==", employee.name).limit(2).get(),
  ]);
  // Older annual requests have a name but no employee ID. Match them only when the name is unique.
  const legacyAnnualSnap = sameNameSnap.size === 1
    ? await db.collection(COLLECTIONS.annualLeaveRequests).where("fullName", "==", employee.name).get()
    : null;
  const annualDocs = new Map(annualSnap.docs.map((doc) => [doc.id, doc]));
  for (const doc of legacyAnnualSnap?.docs ?? []) {
    if (!doc.data().employeeId) annualDocs.set(doc.id, doc);
  }

  const family: RequestHistoryEntry[] = familySnap.docs.map((doc) => {
    const request = doc.data() as FamilyLeaveRequestSummary;
    const status = statusOf(request.approvalStatus);
    return {
      id: doc.id,
      kind: request.leaveType === "salaam" ? "salaam" : "family",
      status,
      submittedAt: isoDateTime(request.submittedAt) || `${request.requestDate}T00:00:00.000Z`,
      reviewedAt: isoDateTime(request.reviewedAt),
      reviewer: request.supervisor?.name,
      startDate: request.leaveStartDate || request.requestDate,
      endDate: request.leaveEndDate || request.requestDate,
      totalDays: request.durationDays,
      reason: request.reason,
      editable: status === "Pending",
    };
  });
  const annual: RequestHistoryEntry[] = [...annualDocs.values()].map((doc) => {
    const request = doc.data() as AnnualLeaveRequest;
    const status = statusOf(request.approvalStatus);
    return {
      id: doc.id,
      kind: "annual",
      status,
      submittedAt: isoDateTime(request.createdAt) || `${request.startDate}T00:00:00.000Z`,
      reviewedAt: isoDateTime(request.approvedAt) || request.approver?.assignedDate,
      reviewer: request.approver?.name || request.actionBy,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
      reason: request.reason,
      chitAvailable: status === "Approved" && Boolean(request.approver && request.signatureReady),
      // Legacy requests matched only by name can't be edited from the portal.
      editable: status === "Pending" && request.employeeId === employeeId,
      takeoverEmployeeId: request.takeover?.employeeId,
    };
  });
  const overtime: RequestHistoryEntry[] = overtimeSnap.docs.flatMap((doc) => {
    const request = doc.data() as OvertimeRequest;
    if (!request.employees?.some((item) => item.employeeId === employeeId)) return [];
    const status = statusOf(request.approvalStatus);
    return [{
      id: doc.id,
      kind: "ot" as const,
      status,
      submittedAt: isoDateTime(request.createdAt) || `${request.workDate || "1970-01-01"}T00:00:00.000Z`,
      reviewedAt: status === "Pending" ? undefined : isoDateTime((request as OvertimeRequest & { updatedAt?: unknown }).updatedAt),
      reviewer: request.actionBy,
      startDate: request.workDate,
      endDate: request.workDate,
      reason: request.details,
      // OT entered by an admin for several people stays read-only for each of them.
      editable: status === "Pending" && request.employees.length === 1,
      startTime: request.startTime,
      endTime: request.endTime,
    }];
  });
  return [...family, ...annual, ...overtime]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
