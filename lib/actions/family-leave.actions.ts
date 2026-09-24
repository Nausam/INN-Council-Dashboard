"use server";

import { randomUUID } from "node:crypto";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchEmployeeById } from "@/lib/firebase/hr";
import { fillSalaamFamilyLeaveTemplate } from "@/lib/forms/salaam-family-leave";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import {
  isSalaamFamilyLeaveType,
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
  supervisor?: AssignedLeaveSupervisor;
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

export async function submitFamilyLeaveRequest(input: {
  employeeId: string;
  leaveType: string;
  reason: string;
}): Promise<
  | { ok: true; id: string; requestDate: string; reportedTime: string }
  | { ok: false; code: "missing_dhivehi_details" }
> {
  const profile = await getSessionAuthProfile();
  if (!profile) throw new Error("Unauthorized");

  const employeeId = String(input.employeeId ?? "").trim();
  const leaveType = String(input.leaveType ?? "");
  const reason = String(input.reason ?? "").trim();
  if (!/^[\w-]{1,128}$/.test(employeeId)) {
    throw new Error("Invalid employee");
  }
  if (!isSalaamFamilyLeaveType(leaveType)) {
    throw new Error("Invalid leave type");
  }
  if (!isDhivehiText(reason, 300)) {
    throw new Error("Leave reason must be written in Dhivehi");
  }

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
  const { date, displayDate, time } = maldivesDateTime(now);
  const document = await fillSalaamFamilyLeaveTemplate({
    leaveType,
    date: displayDate,
    time,
    reason,
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
    submittedAt: now.toISOString(),
    submittedBy: profile.email || profile.fullName,
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
  if (!isSalaamFamilyLeaveType(request.leaveType)) {
    throw new Error("Leave type is missing from this form");
  }
  const requesterSnap = /^[\w-]{1,128}$/.test(request.employeeId ?? "")
    ? await db.collection(COLLECTIONS.employees).doc(request.employeeId).get()
    : null;
  const requester = requesterSnap?.data() ?? {};
  const employeeNameDv = String(request.employeeNameDv || requester.nameDv || "").trim();
  const addressDv = String(request.addressDv || requester.addressDv || "").trim();
  const employeeDesignationDv = String(request.designationDv || requester.designationDv || "").trim();
  if (
    !isDhivehiText(employeeNameDv, 100) ||
    !isDhivehiText(addressDv, 150) ||
    !isDhivehiText(employeeDesignationDv, 100)
  ) {
    throw new Error("Complete the employee's Dhivehi details before assigning a supervisor");
  }
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
  const dateParts = request.requestDate.split("-");
  if (dateParts.length !== 3) throw new Error("Leave form date is invalid");
  const document = await fillSalaamFamilyLeaveTemplate({
    leaveType: request.leaveType,
    date: `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`,
    time: request.reportedTime,
    reason: request.reason,
    employeeNameDv,
    addressDv,
    designationDv: employeeDesignationDv,
    supervisor,
  });
  const batch = db.batch();
  batch.update(requestRef, {
    supervisor,
    employeeNameDv,
    addressDv,
    designationDv: employeeDesignationDv,
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
