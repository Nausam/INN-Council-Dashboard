"use server";

import { getRequestApprover } from "@/lib/auth/request-approvers";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import type { OvertimeRequest } from "@/lib/firebase/types";
import { fileProxyUrl } from "@/lib/files";
import { isSalaamKind } from "@/lib/leave/salaam-family-types";
import { getLeaveSupervisor, LEAVE_SUPERVISORS, type LeaveSupervisorKey } from "@/lib/leave/supervisors";
import {
  approveAnnualLeaveRequest,
  assignAnnualLeavePerson,
  rejectAnnualLeaveRequest,
  type AnnualLeaveRequest,
} from "@/lib/actions/annual-leave.actions";
import {
  assignFamilyLeaveSupervisor,
  reviewFamilyLeaveRequest,
  type FamilyLeaveRequestSummary,
} from "@/lib/actions/family-leave.actions";
import { reviewOvertimeRequest } from "@/lib/actions/overtime-requests.actions";
import type { RequestHistoryKind, RequestHistoryStatus } from "@/lib/actions/request-history.actions";

export type ApprovalRequest = {
  id: string;
  kind: RequestHistoryKind;
  status: RequestHistoryStatus;
  /** Who asked; for OT, everyone on the request. */
  employeeNames: string[];
  submittedAt: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  startTime?: string;
  endTime?: string;
  reason?: string;
  /** Supervisor whose signature goes on the leave form (leave requests only). */
  signerKey?: LeaveSupervisorKey;
  reviewer?: string;
  reviewedAt?: string;
  /** The viewer's own request: shown, but they can't decide it. */
  own: boolean;
  /** Certificate Salaam: link to the uploaded medical certificate. */
  certificateUrl?: string;
};

export type ApprovalInbox = {
  supervisors: Array<{ key: LeaveSupervisorKey; label: string }>;
  /** The viewer's supervisor key, used as the default signer when they are one. */
  viewerSupervisorKey?: LeaveSupervisorKey;
  pending: ApprovalRequest[];
  reviewed: ApprovalRequest[];
};

const REVIEWED_LIMIT = 30;

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

function supervisorKeyFor(employeeId?: string): LeaveSupervisorKey | undefined {
  return LEAVE_SUPERVISORS.find((item) => item.employeeId === employeeId)?.key;
}

type DocSnap = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;

function familyRequest(doc: DocSnap, viewerId: string): ApprovalRequest {
  const request = doc.data() as FamilyLeaveRequestSummary;
  const startDate = request.leaveStartDate || request.requestDate;
  return {
    id: doc.id,
    kind: isSalaamKind(request.leaveType) ? "salaam" : "family",
    status: statusOf(request.approvalStatus),
    employeeNames: [request.employeeName],
    submittedAt: isoDateTime(request.submittedAt) || `${request.requestDate}T00:00:00.000Z`,
    startDate,
    endDate: request.leaveEndDate || request.secondDay?.date || startDate,
    totalDays: request.durationDays,
    reason: request.reason,
    signerKey: request.supervisor?.key,
    reviewer: request.supervisor?.name || request.reviewedBy,
    reviewedAt: isoDateTime(request.reviewedAt),
    own: request.employeeId === viewerId,
    certificateUrl: request.certificate ? fileProxyUrl(request.certificate.key) : undefined,
  };
}

function annualRequest(doc: DocSnap, viewerId: string): ApprovalRequest {
  const request = doc.data() as AnnualLeaveRequest;
  const status = statusOf(request.approvalStatus);
  return {
    id: doc.id,
    kind: "annual",
    status,
    employeeNames: [request.fullName],
    submittedAt: isoDateTime(request.createdAt) || `${request.startDate}T00:00:00.000Z`,
    startDate: request.startDate,
    endDate: request.endDate || request.startDate,
    totalDays: request.totalDays,
    reason: request.reason,
    signerKey: supervisorKeyFor(request.approver?.employeeId),
    reviewer: status === "Rejected" ? request.actionBy : request.approver?.name || request.actionBy,
    reviewedAt: isoDateTime(request.approvedAt) || isoDateTime(request.rejectedAt),
    own: request.employeeId === viewerId,
  };
}

function overtimeRequest(doc: DocSnap, viewerId: string): ApprovalRequest {
  const request = doc.data() as OvertimeRequest & { updatedAt?: unknown };
  const status = statusOf(request.approvalStatus);
  return {
    id: doc.id,
    kind: "ot",
    status,
    employeeNames: (request.employees ?? []).map((item) => item.name).filter(Boolean),
    submittedAt: isoDateTime(request.createdAt) || `${request.workDate || "1970-01-01"}T00:00:00.000Z`,
    startDate: request.workDate,
    endDate: request.workDate,
    startTime: request.startTime,
    endTime: request.endTime,
    reason: request.details,
    reviewer: request.actionBy,
    reviewedAt: status === "Pending" ? undefined : isoDateTime(request.updatedAt),
    own: Boolean(request.employees?.some((item) => item.employeeId === viewerId)),
  };
}

/** Every request still waiting for a decision. Each one is created with approvalStatus "Pending". */
async function loadPending(viewerId: string): Promise<ApprovalRequest[]> {
  const db = getFirestoreDb();
  const pending = (name: string) => db.collection(name).where("approvalStatus", "==", "Pending").get();
  const [family, annual, overtime] = await Promise.all([
    pending(COLLECTIONS.familyLeaveRequests),
    pending(COLLECTIONS.annualLeaveRequests),
    pending(COLLECTIONS.overtimeRequests),
  ]);
  return [
    ...family.docs.map((doc) => familyRequest(doc, viewerId)),
    ...annual.docs.map((doc) => annualRequest(doc, viewerId)),
    ...overtime.docs.map((doc) => overtimeRequest(doc, viewerId)),
  ];
}

/** The most recently submitted requests of each kind that have been decided. */
async function loadRecentReviewed(viewerId: string): Promise<ApprovalRequest[]> {
  const db = getFirestoreDb();
  const recent = (name: string, field: string) =>
    db.collection(name).orderBy(field, "desc").limit(REVIEWED_LIMIT + 10).get();
  const [family, annual, overtime] = await Promise.all([
    recent(COLLECTIONS.familyLeaveRequests, "submittedAt"),
    recent(COLLECTIONS.annualLeaveRequests, "createdAt"),
    recent(COLLECTIONS.overtimeRequests, "createdAt"),
  ]);
  return [
    ...family.docs.map((doc) => familyRequest(doc, viewerId)),
    ...annual.docs.map((doc) => annualRequest(doc, viewerId)),
    ...overtime.docs.map((doc) => overtimeRequest(doc, viewerId)),
  ].filter((request) => request.status !== "Pending");
}

async function loadRequest(kind: RequestHistoryKind, id: string, viewerId: string): Promise<ApprovalRequest | null> {
  const db = getFirestoreDb();
  const name = kind === "ot"
    ? COLLECTIONS.overtimeRequests
    : kind === "annual" ? COLLECTIONS.annualLeaveRequests : COLLECTIONS.familyLeaveRequests;
  const doc = await db.collection(name).doc(id).get();
  if (!doc.exists) return null;
  const request = kind === "ot" ? overtimeRequest(doc, viewerId)
    : kind === "annual" ? annualRequest(doc, viewerId) : familyRequest(doc, viewerId);
  return request.kind === kind ? request : null;
}

/** How many requests wait on the signed-in approver; null when they aren't one. */
export async function getPendingApprovalCount(): Promise<number | null> {
  const approver = await getRequestApprover();
  if (!approver) return null;
  const pending = await loadPending(approver.employeeId);
  return pending.filter((request) => !request.own).length;
}

export async function listApprovalInbox(): Promise<ApprovalInbox> {
  const approver = await getRequestApprover();
  if (!approver) throw new Error("Unauthorized");
  const [pendingRequests, reviewedRequests] = await Promise.all([
    loadPending(approver.employeeId),
    loadRecentReviewed(approver.employeeId),
  ]);
  const pending = pendingRequests.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const reviewed = reviewedRequests
    .sort((a, b) => (b.reviewedAt || b.submittedAt).localeCompare(a.reviewedAt || a.submittedAt))
    .slice(0, REVIEWED_LIMIT);
  return {
    supervisors: LEAVE_SUPERVISORS.map(({ key, label }) => ({ key, label })),
    viewerSupervisorKey: supervisorKeyFor(approver.employeeId),
    pending,
    reviewed,
  };
}

function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message && message !== "Unauthorized" && message !== "Forbidden"
    ? message
    : "Could not update this request. Please try again.";
}

/**
 * Approves or rejects a request from the Employee Profile app. Leave approvals
 * first record the signing supervisor, then run the same approval as the admin
 * pages (attendance sheets, leave balance and the annual leave chit).
 */
export async function decideApprovalRequest(input: {
  kind: RequestHistoryKind;
  id: string;
  status: "Approved" | "Rejected";
  signerKey?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const approver = await getRequestApprover();
  if (!approver) return { ok: false, message: "You can't review requests." };
  const { kind, id, status } = input;
  if (!/^[\w-]{1,128}$/.test(id) || (status !== "Approved" && status !== "Rejected")) {
    return { ok: false, message: "Invalid request" };
  }
  const current = await loadRequest(kind, id, approver.employeeId);
  if (!current) return { ok: false, message: "This request no longer exists." };
  if (current.own) return { ok: false, message: "Someone else needs to review your own request." };
  if (current.status !== "Pending") return { ok: false, message: `This request was already ${current.status.toLowerCase()}.` };

  try {
    if (kind === "ot") {
      await reviewOvertimeRequest(id, status);
      return { ok: true };
    }
    const signer = status === "Approved" ? getLeaveSupervisor(String(input.signerKey ?? "")) : undefined;
    if (status === "Approved" && !signer) return { ok: false, message: "Choose the supervisor who signs this leave." };
    if (kind === "annual") {
      if (status === "Rejected") {
        await rejectAnnualLeaveRequest(id);
        return { ok: true };
      }
      if (current.signerKey !== signer!.key) await assignAnnualLeavePerson(id, "approver", signer!.employeeId);
      return await approveAnnualLeaveRequest(id);
    }
    if (status === "Approved" && current.signerKey !== signer!.key) await assignFamilyLeaveSupervisor(id, signer!.key);
    return await reviewFamilyLeaveRequest(id, status);
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
