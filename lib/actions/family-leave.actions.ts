"use server";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees, fetchEmployeeById } from "@/lib/firebase/hr";
import { fillSalaamFamilyLeaveTemplate } from "@/lib/forms/salaam-family-leave";
import { displayLeaveDate, parseLeaveDateRange, templateDaysForRange } from "@/lib/leave/date-range";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import {
  isSalaamFamilyLeaveType,
  type LeaveDayDetails,
  type SalaamFamilyLeaveType,
} from "@/lib/leave/salaam-family-types";
import {
  getLeaveSupervisor,
  LEAVE_SUPERVISORS,
  type LeaveSupervisorKey,
} from "@/lib/leave/supervisors";

export type AssignedLeaveSupervisor = {
  key: LeaveSupervisorKey;
  employeeId: string;
  name: string;
  nameDv: string;
  designationDv: string;
  sectionDv: string;
  reportedDate: string;
  reportedTime: string;
  assignedAt: string;
};

export type AssignedLeaveAcceptor = {
  employeeId: string;
  name: string;
  nameDv: string;
  designationDv: string;
  acceptedDate: string;
  acceptedTime: string;
  assignedAt: string;
};

export type FamilyLeaveRequestSummary = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNameDv?: string;
  addressDv?: string;
  designationDv?: string;
  leaveType?: SalaamFamilyLeaveType;
  requestDate: string;
  reportedTime: string;
  reason: string;
  submittedAt: string;
  submittedBy: string;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
  reviewedAt?: string;
  reviewedBy?: string;
  leaveStartDate?: string;
  leaveEndDate?: string;
  durationDays?: number;
  // Kept for requests submitted before the date-range form.
  secondDay?: LeaveDayDetails;
  additionalDetails?: LeaveDayDetails;
  supervisor?: AssignedLeaveSupervisor;
  acceptor?: AssignedLeaveAcceptor;
};

export type FamilyLeaveRequestPage = {
  requests: FamilyLeaveRequestSummary[];
  nextCursor: string | null;
  totalCount: number;
};

export type LeaveSupervisorOption = {
  key: LeaveSupervisorKey;
  label: string;
  employeeId: string;
  employeeName: string;
  ready: boolean;
  missing: string[];
};

export type LeaveAcceptorOption = {
  employeeId: string;
  name: string;
  ready: boolean;
  missing: string[];
};

export async function submitFamilyLeaveRequest(input: {
  employeeId: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
}): Promise<
  | { ok: true; id: string; requestDate: string; reportedTime: string }
  | { ok: false; code: "missing_dhivehi_details" }
> {
  const profile = await getSessionAuthProfile();
  if (!profile) throw new Error("Unauthorized");

  const employeeId = String(input.employeeId ?? "").trim();
  const leaveType = String(input.leaveType ?? "");
  const reason = String(input.reason ?? "").trim();
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  if (!/^[\w-]{1,128}$/.test(employeeId)) {
    throw new Error("Invalid employee");
  }
  if (!isSalaamFamilyLeaveType(leaveType)) {
    throw new Error("Invalid leave type");
  }
  if (!isDhivehiText(reason, 300)) {
    throw new Error("Leave reason must be written in Dhivehi");
  }
  const range = parseLeaveDateRange(startDate, endDate);

  const employee = await fetchEmployeeById(employeeId);
  const employeeNameDv = typeof employee.nameDv === "string" ? employee.nameDv.trim() : "";
  const addressDv = typeof employee.addressDv === "string" ? employee.addressDv.trim() : "";
  const designationDv = typeof employee.designationDv === "string" ? employee.designationDv.trim() : "";
  if (
    !isDhivehiText(employeeNameDv, 100) ||
    !isDhivehiText(addressDv, 150) ||
    !isDhivehiText(designationDv, 100)
  ) {
    return { ok: false, code: "missing_dhivehi_details" };
  }
  const now = new Date();
  const { date, time } = maldivesDateTime(now);
  const templateDays = templateDaysForRange(range.startDate, range.endDate, time, reason);
  const document = await fillSalaamFamilyLeaveTemplate({
    leaveType,
    date: templateDays.date,
    time,
    reason,
    secondDay: templateDays.secondDay,
    additionalDetails: templateDays.additionalDetails,
    employeeNameDv,
    addressDv,
    designationDv,
  });

  const id = randomUUID();
  const db = getFirestoreDb();
  const batch = db.batch();
  const summary: FamilyLeaveRequestSummary = {
    id,
    employeeId,
    employeeName: employee.name,
    employeeNameDv,
    addressDv,
    designationDv,
    leaveType,
    requestDate: date,
    reportedTime: time,
    reason,
    leaveStartDate: range.startDate,
    leaveEndDate: range.endDate,
    durationDays: range.durationDays,
    submittedAt: now.toISOString(),
    submittedBy: profile.email || profile.fullName,
    approvalStatus: "Pending",
  };
  batch.set(db.collection(COLLECTIONS.familyLeaveRequests).doc(id), summary);
  batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(id), {
    dataBase64: document.toString("base64"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  await batch.commit();
  return { ok: true, id, requestDate: date, reportedTime: time };
}

export async function listFamilyLeaveRequests(afterId?: string): Promise<FamilyLeaveRequestPage> {
  await requireAdmin();
  const collection = getFirestoreDb().collection(COLLECTIONS.familyLeaveRequests);
  let query = collection.orderBy("submittedAt", "desc");
  if (afterId) {
    if (!/^[\w-]{1,128}$/.test(afterId)) throw new Error("Invalid page cursor");
    const cursor = await collection.doc(afterId).get();
    if (!cursor.exists) throw new Error("Page cursor no longer exists");
    query = query.startAfter(cursor);
  }
  const pageSize = 12;
  const [snap, countSnap] = await Promise.all([
    query.limit(pageSize + 1).get(),
    collection.count().get(),
  ]);
  const visible = snap.docs.slice(0, pageSize);
  return {
    requests: visible.map((doc) => ({
      ...(doc.data() as Omit<FamilyLeaveRequestSummary, "id">),
      id: doc.id,
    })),
    nextCursor: snap.docs.length > pageSize ? visible[visible.length - 1]?.id ?? null : null,
    totalCount: countSnap.data().count,
  };
}

export async function listLeaveSupervisors(): Promise<LeaveSupervisorOption[]> {
  await requireAdmin();
  const collection = getFirestoreDb().collection(COLLECTIONS.employees);
  return Promise.all(
    LEAVE_SUPERVISORS.map(async (supervisor) => {
      const snap = await collection.doc(supervisor.employeeId).get();
      const employee = snap.data() ?? {};
      const missing = [
        !isDhivehiText(String(employee.nameDv ?? ""), 100) ? "name" : null,
        !isDhivehiText(String(employee.designationDv ?? ""), 100) ? "designation" : null,
        !isDhivehiText(String(employee.sectionDv ?? ""), 100) ? "section" : null,
      ].filter((value): value is string => value !== null);
      return {
        key: supervisor.key,
        label: supervisor.label,
        employeeId: supervisor.employeeId,
        employeeName: typeof employee.name === "string" ? employee.name : supervisor.label,
        ready: snap.exists && missing.length === 0,
        missing,
      };
    }),
  );
}

export async function listLeaveAcceptors(): Promise<LeaveAcceptorOption[]> {
  await requireAdmin();
  const employees = await fetchAllEmployees();
  return employees
    .map((employee) => {
      const missing = [
        !isDhivehiText(String(employee.nameDv ?? ""), 100) ? "name" : null,
        !isDhivehiText(String(employee.designationDv ?? ""), 100) ? "designation" : null,
      ].filter((value): value is string => value !== null);
      return {
        employeeId: employee.$id,
        name: employee.name,
        ready: missing.length === 0,
        missing,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function renderAssignedForm(
  db: ReturnType<typeof getFirestoreDb>,
  request: FamilyLeaveRequestSummary,
  supervisor: AssignedLeaveSupervisor | undefined,
  acceptor: AssignedLeaveAcceptor | undefined,
) {
  if (!isSalaamFamilyLeaveType(request.leaveType)) {
    throw new Error("Leave type is missing from this form");
  }
  const requesterSnap = /^[\w-]{1,128}$/.test(request.employeeId ?? "")
    ? await db.collection(COLLECTIONS.employees).doc(request.employeeId).get()
    : null;
  const requester = requesterSnap?.data() ?? {};
  const employeeNameDv = String(request.employeeNameDv || requester.nameDv || "").trim();
  const addressDv = String(request.addressDv || requester.addressDv || "").trim();
  const designationDv = String(request.designationDv || requester.designationDv || "").trim();
  if (
    !isDhivehiText(employeeNameDv, 100) ||
    !isDhivehiText(addressDv, 150) ||
    !isDhivehiText(designationDv, 100)
  ) {
    throw new Error("Complete the employee's Dhivehi details before assigning the form");
  }
  const dateParts = request.requestDate.split("-");
  if (dateParts.length !== 3) throw new Error("Leave form date is invalid");
  const templateDays = request.leaveStartDate && request.leaveEndDate
    ? templateDaysForRange(request.leaveStartDate, request.leaveEndDate, request.reportedTime, request.reason)
    : null;
  const document = await fillSalaamFamilyLeaveTemplate({
    leaveType: request.leaveType,
    date: templateDays ? templateDays.date : `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`,
    time: request.reportedTime,
    reason: request.reason,
    secondDay: templateDays ? templateDays.secondDay : (request.secondDay
      ? { ...request.secondDay, date: displayLeaveDate(request.secondDay.date) }
      : undefined),
    additionalDetails: templateDays ? templateDays.additionalDetails : (request.additionalDetails
      ? { ...request.additionalDetails, date: displayLeaveDate(request.additionalDetails.date) }
      : undefined),
    employeeNameDv,
    addressDv,
    designationDv,
    supervisor,
    acceptor,
  });
  return { document, employeeNameDv, addressDv, designationDv };
}

export async function assignFamilyLeaveSupervisor(
  requestId: string,
  supervisorKey: string,
): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const choice = getLeaveSupervisor(supervisorKey);
  if (!choice) throw new Error("Invalid supervisor");

  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId);
  const [requestSnap, employeeSnap] = await Promise.all([
    requestRef.get(),
    db.collection(COLLECTIONS.employees).doc(choice.employeeId).get(),
  ]);
  if (!requestSnap.exists) throw new Error("Leave form not found");
  if (!employeeSnap.exists) throw new Error("Supervisor employee record not found");
  const request = requestSnap.data() as FamilyLeaveRequestSummary;
  const employee = employeeSnap.data() ?? {};
  const nameDv = String(employee.nameDv ?? "").trim();
  const designationDv = String(employee.designationDv ?? "").trim();
  const sectionDv = String(employee.sectionDv ?? "").trim();
  if (
    !isDhivehiText(nameDv, 100) ||
    !isDhivehiText(designationDv, 100) ||
    !isDhivehiText(sectionDv, 100)
  ) {
    throw new Error(`Add ${choice.label}'s Dhivehi name, designation, and section in the employee edit form`);
  }

  const now = new Date();
  const { displayDate, time } = maldivesDateTime(now);
  const supervisor: AssignedLeaveSupervisor = {
    key: choice.key,
    employeeId: choice.employeeId,
    name: typeof employee.name === "string" ? employee.name : choice.label,
    nameDv,
    designationDv,
    sectionDv,
    reportedDate: displayDate,
    reportedTime: time,
    assignedAt: now.toISOString(),
  };
  const { document, employeeNameDv, addressDv, designationDv: requesterDesignationDv } =
    await renderAssignedForm(db, request, supervisor, request.acceptor);
  const batch = db.batch();
  batch.update(requestRef, {
    supervisor,
    employeeNameDv,
    addressDv,
    designationDv: requesterDesignationDv,
    ...(request.approvalStatus === "Approved"
      ? { approvalStatus: "Pending", reviewedAt: FieldValue.delete(), reviewedBy: FieldValue.delete() }
      : {}),
  });
  batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(requestId), {
    dataBase64: document.toString("base64"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  await batch.commit();
}

export async function assignFamilyLeaveAcceptor(
  requestId: string,
  employeeId: string,
): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");

  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId);
  const [requestSnap, employeeSnap] = await Promise.all([
    requestRef.get(),
    db.collection(COLLECTIONS.employees).doc(employeeId).get(),
  ]);
  if (!requestSnap.exists) throw new Error("Leave form not found");
  if (!employeeSnap.exists) throw new Error("Employee record not found");

  const employee = employeeSnap.data() ?? {};
  const nameDv = String(employee.nameDv ?? "").trim();
  const designationDv = String(employee.designationDv ?? "").trim();
  if (!isDhivehiText(nameDv, 100) || !isDhivehiText(designationDv, 100)) {
    throw new Error("Add the receiving employee's Dhivehi name and designation in the employee edit form");
  }

  const now = new Date();
  const { displayDate, time } = maldivesDateTime(now);
  const acceptor: AssignedLeaveAcceptor = {
    employeeId,
    name: typeof employee.name === "string" ? employee.name : nameDv,
    nameDv,
    designationDv,
    acceptedDate: displayDate,
    acceptedTime: time,
    assignedAt: now.toISOString(),
  };
  const request = requestSnap.data() as FamilyLeaveRequestSummary;
  const { document, employeeNameDv, addressDv, designationDv: requesterDesignationDv } =
    await renderAssignedForm(db, request, request.supervisor, acceptor);
  const batch = db.batch();
  batch.update(requestRef, {
    acceptor,
    employeeNameDv,
    addressDv,
    designationDv: requesterDesignationDv,
  });
  batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(requestId), {
    dataBase64: document.toString("base64"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  await batch.commit();
}

export async function deleteFamilyLeaveRequest(requestId: string): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const db = getFirestoreDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId));
  batch.delete(db.collection(COLLECTIONS.familyLeaveDocuments).doc(requestId));
  await batch.commit();
}

export async function reviewFamilyLeaveRequest(
  requestId: string,
  status: "Approved" | "Rejected",
): Promise<void> {
  const profile = await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  if (status !== "Approved" && status !== "Rejected") throw new Error("Invalid status");
  const ref = getFirestoreDb().collection(COLLECTIONS.familyLeaveRequests).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Leave form not found");
  const request = snap.data() as FamilyLeaveRequestSummary;
  if (status === "Approved" && !request.supervisor) {
    throw new Error("Select a supervisor before approving this leave request");
  }
  await ref.update({
    approvalStatus: status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: profile.email || profile.fullName,
  });
}
