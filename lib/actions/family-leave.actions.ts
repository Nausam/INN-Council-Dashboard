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
import { fillSalaamFamilyLeaveTemplate } from "@/lib/forms/salaam-family-leave";
import { parseLeaveDateRange, templateDaysForRange } from "@/lib/leave/date-range";
import { formReceivedDate, renderFamilyLeaveForm } from "@/lib/leave/family-leave-form";
import { randomReceivedTime, randomReportedTime } from "@/lib/leave/reported-time";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import {
  ATTENDANCE_LEAVE_TYPE,
  isSalaamFamilyLeaveType,
  LEAVE_CERTIFICATE_MAX_BYTES,
  LEAVE_CERTIFICATE_PREFIX,
  type LeaveCertificate,
  type LeaveDayDetails,
  type SalaamFamilyLeaveType,
} from "@/lib/leave/salaam-family-types";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2";
import {
  getLeaveSupervisor,
  LEAVE_SUPERVISORS,
  type LeaveSupervisorKey,
} from "@/lib/leave/supervisors";
import {
  applyApprovedLeaveToAttendance,
  leaveAttendanceFailure,
  moveApprovedLeave,
  revertApprovedLeaveFromAttendance,
  type AppliedLeaveAttendance,
} from "@/lib/leave/approved-leave-attendance";


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
  attendanceLeave?: AppliedLeaveAttendance;
  /** Certificate Salaam only: the medical certificate the employee uploaded. */
  certificate?: LeaveCertificate;
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

const CERTIFICATE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

type CertificateProblem = "certificate_required" | "certificate_invalid";

/** Checks the file's first bytes, so a renamed file of another kind is rejected. */
function matchesCertificateSignature(bytes: Uint8Array, type: keyof typeof CERTIFICATE_TYPES): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  if (type === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return ascii(0, 5) === "%PDF-";
}

/** The certificate file sent with a form (field "certificate"), checked but not stored yet. */
async function readCertificate(form: FormData | undefined) {
  const file = form?.get("certificate");
  if (!(file instanceof Blob) || file.size === 0) return "certificate_required" as const;
  const type = file.type as keyof typeof CERTIFICATE_TYPES;
  if (file.size > LEAVE_CERTIFICATE_MAX_BYTES || !(type in CERTIFICATE_TYPES)) return "certificate_invalid" as const;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesCertificateSignature(bytes, type)) return "certificate_invalid" as const;
  const name = file instanceof File ? file.name : "";
  return { bytes, type, fileName: name.slice(0, 120) || `certificate.${CERTIFICATE_TYPES[type]}` };
}

async function storeCertificate(
  employeeId: string,
  name: string,
  file: Exclude<Awaited<ReturnType<typeof readCertificate>>, CertificateProblem>,
): Promise<LeaveCertificate> {
  if (!isR2Configured()) throw new Error("File storage is not configured");
  const key = `${LEAVE_CERTIFICATE_PREFIX}${employeeId}/${name}.${CERTIFICATE_TYPES[file.type]}`;
  await uploadToR2(key, file.bytes, file.type);
  return { key, contentType: file.type, fileName: file.fileName, size: file.bytes.byteLength };
}

async function deleteCertificate(certificate: LeaveCertificate | undefined): Promise<void> {
  if (!certificate?.key.startsWith(LEAVE_CERTIFICATE_PREFIX)) return;
  // Nothing points at it any more; a failed delete only leaves an orphan.
  await deleteFromR2(certificate.key).catch((error) => console.error("Could not delete leave certificate:", error));
}

/**
 * Submits a Salaam, Certificate Salaam, or Family leave form. Certificate
 * Salaam needs `certificateForm` with the medical certificate (image or PDF).
 */
export async function submitFamilyLeaveRequest(input: {
  employeeId: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
}, certificateForm?: FormData): Promise<
  | { ok: true; id: string; requestDate: string; reportedTime: string }
  | { ok: false; code: "missing_dhivehi_details" | CertificateProblem }
> {
  const employeeId = String(input.employeeId ?? "").trim();
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
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
  const certificateFile = leaveType === "certificateSalaam" ? await readCertificate(certificateForm) : null;
  if (typeof certificateFile === "string") return { ok: false, code: certificateFile };

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
  const { date } = maldivesDateTime(now);
  const time = randomReportedTime();
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
  const certificate = certificateFile ? await storeCertificate(employeeId, id, certificateFile) : undefined;
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
    submittedBy: profile?.email || profile?.fullName || employee.name,
    approvalStatus: "Pending",
    ...(certificate ? { certificate } : {}),
  };
  batch.set(db.collection(COLLECTIONS.familyLeaveRequests).doc(id), summary);
  batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(id), {
    dataBase64: document.toString("base64"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  await batch.commit();
  return { ok: true, id, requestDate: date, reportedTime: time };
}

/**
 * Lets the employee change the dates and reason of their own Salaam or Family
 * leave form while it is still pending; admins can also change approved and
 * rejected forms. The leave type and the original reported date and time stay
 * as they were, and the stored form document is rebuilt so admins see the
 * updated details. On an approved form the leave marked in attendance moves to
 * the new dates. A Certificate Salaam form can also get a new certificate
 * through `certificateForm`.
 */
export async function updateFamilyLeaveRequest(input: {
  employeeId: string;
  requestId: string;
  reason: string;
  startDate: string;
  endDate: string;
}, certificateForm?: FormData): Promise<
  | { ok: true }
  | { ok: false; code: "not_editable" | "certificate_invalid" }
  | { ok: false; code: "attendance"; message: string }
> {
  const employeeId = String(input.employeeId ?? "").trim();
  const requestId = String(input.requestId ?? "").trim();
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId) || !/^[\w-]{1,128}$/.test(requestId)) {
    throw new Error("Invalid request");
  }
  const admin = Boolean(profile?.isAdmin);
  const reason = String(input.reason ?? "").trim();
  if (!isDhivehiText(reason, 300)) {
    throw new Error("Leave reason must be written in Dhivehi");
  }
  const range = parseLeaveDateRange(String(input.startDate ?? "").trim(), String(input.endDate ?? "").trim());

  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId);
  const snap = await requestRef.get();
  const current = snap.data() as FamilyLeaveRequestSummary | undefined;
  if (!current || current.employeeId !== employeeId || (!admin && isReviewed(current.approvalStatus))) {
    return { ok: false, code: "not_editable" };
  }

  const replacement = current.leaveType === "certificateSalaam" && certificateForm?.get("certificate")
    ? await readCertificate(certificateForm)
    : null;
  if (typeof replacement === "string") return { ok: false, code: "certificate_invalid" };
  const certificate = replacement
    ? await storeCertificate(employeeId, `${requestId}-${randomUUID().slice(0, 8)}`, replacement)
    : undefined;

  const edited = {
    reason,
    leaveStartDate: range.startDate,
    leaveEndDate: range.endDate,
    durationDays: range.durationDays,
    ...(certificate ? { certificate } : {}),
  };
  const updated = { ...current, ...edited, secondDay: undefined, additionalDetails: undefined };
  // The office receives the form after the leave, so new dates move that day too.
  const acceptor = current.acceptor && { ...current.acceptor, acceptedDate: await formReceivedDate(updated) };
  const changes = { ...edited, ...(acceptor ? { acceptor } : {}) };
  const { document } = await renderFamilyLeaveForm(db, updated, current.supervisor, acceptor);

  let attendanceLeave: AppliedLeaveAttendance | undefined;
  if (current.approvalStatus === "Approved" && current.attendanceLeave) {
    try {
      const moved = await moveApprovedLeave(employeeId, current.attendanceLeave, range.startDate, range.endDate);
      if (moved.problem) {
        // Attendance changed partway; record what it holds and leave the form's dates as they were.
        await requestRef.update({ attendanceLeave: moved.applied });
        if (certificate) await deleteCertificate(certificate);
        return { ok: false, code: "attendance", message: moved.problem };
      }
      attendanceLeave = moved.applied;
    } catch (error) {
      if (certificate) await deleteCertificate(certificate);
      return { ...leaveAttendanceFailure(error), code: "attendance" };
    }
  }

  // Re-check inside the transaction so a review that lands while the form was
  // being rebuilt is never overwritten.
  const result = await db.runTransaction(async (transaction) => {
    const latest = (await transaction.get(requestRef)).data() as FamilyLeaveRequestSummary | undefined;
    const reviewChanged = admin
      ? latest?.approvalStatus !== current.approvalStatus
      : isReviewed(latest?.approvalStatus);
    if (!latest || latest.employeeId !== employeeId || reviewChanged) {
      return { ok: false, code: "not_editable" } as const;
    }
    transaction.update(requestRef, {
      ...changes,
      ...(attendanceLeave ? { attendanceLeave } : {}),
      secondDay: FieldValue.delete(),
      additionalDetails: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    transaction.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(requestId), {
      dataBase64: document.toString("base64"),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    return { ok: true } as const;
  });
  // Keep whichever certificate the request ends up pointing at.
  if (certificate) await deleteCertificate(result.ok ? current.certificate : certificate);
  return result;
}

function isReviewed(status: unknown): boolean {
  return status === "Approved" || status === "Rejected";
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

export type FamilyLeaveFormFile = {
  id: string;
  employeeName: string;
  leaveType?: SalaamFamilyLeaveType;
  /** The leave's first day, or the request date on older forms. */
  date: string;
  /** Whether the form says who received it yet. */
  hasReceiver: boolean;
};

/**
 * Every form's id and the details its file is named by, newest first. The
 * browser then fetches and zips the forms, since a zip of them all can be
 * larger than a server response is allowed to be.
 */
export async function listFamilyLeaveFormFiles(): Promise<FamilyLeaveFormFile[]> {
  await requireAdmin();
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.familyLeaveRequests)
    .orderBy("submittedAt", "desc")
    .select("employeeName", "leaveType", "leaveStartDate", "requestDate", "acceptor")
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      employeeName: String(data.employeeName ?? ""),
      leaveType: isSalaamFamilyLeaveType(data.leaveType) ? data.leaveType : undefined,
      date: String(data.leaveStartDate || data.requestDate || ""),
      hasReceiver: Boolean(data.acceptor),
    };
  });
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

export async function assignFamilyLeaveSupervisor(
  requestId: string,
  supervisorKey: string,
): Promise<void> {
  await requireRequestReviewer();
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
  const { displayDate } = maldivesDateTime(now);
  const supervisor: AssignedLeaveSupervisor = {
    key: choice.key,
    employeeId: choice.employeeId,
    name: typeof employee.name === "string" ? employee.name : choice.label,
    nameDv,
    designationDv,
    sectionDv,
    reportedDate: displayDate,
    // The form shows the supervisor told at the time the employee reported.
    reportedTime: request.reportedTime,
    assignedAt: now.toISOString(),
  };
  const { document, employeeNameDv, addressDv, designationDv: requesterDesignationDv } =
    await renderFamilyLeaveForm(db, request, supervisor, request.acceptor);
  // A new supervisor sends an approved form back to Pending, so undo its leave days.
  if (request.approvalStatus === "Approved") {
    await revertApprovedLeaveFromAttendance(request.employeeId, request.attendanceLeave);
  }
  const batch = db.batch();
  batch.update(requestRef, {
    supervisor,
    employeeNameDv,
    addressDv,
    designationDv: requesterDesignationDv,
    ...(request.approvalStatus === "Approved"
      ? {
          approvalStatus: "Pending",
          reviewedAt: FieldValue.delete(),
          reviewedBy: FieldValue.delete(),
          attendanceLeave: FieldValue.delete(),
        }
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

  const request = requestSnap.data() as FamilyLeaveRequestSummary;
  // The form is handed in when the employee is back, not when it is assigned here.
  const acceptor: AssignedLeaveAcceptor = {
    employeeId,
    name: typeof employee.name === "string" ? employee.name : nameDv,
    nameDv,
    designationDv,
    acceptedDate: await formReceivedDate(request),
    acceptedTime: randomReceivedTime(),
    assignedAt: new Date().toISOString(),
  };
  const { document, employeeNameDv, addressDv, designationDv: requesterDesignationDv } =
    await renderFamilyLeaveForm(db, request, request.supervisor, acceptor);
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
  const request = (await db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId).get())
    .data() as FamilyLeaveRequestSummary | undefined;
  if (request) await revertApprovedLeaveFromAttendance(request.employeeId, request.attendanceLeave);
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.familyLeaveRequests).doc(requestId));
  batch.delete(db.collection(COLLECTIONS.familyLeaveDocuments).doc(requestId));
  await batch.commit();
  await deleteCertificate(request?.certificate);
}

export async function reviewFamilyLeaveRequest(
  requestId: string,
  status: "Approved" | "Rejected",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reviewer = await requireRequestReviewer();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  if (status !== "Approved" && status !== "Rejected") throw new Error("Invalid status");
  const ref = getFirestoreDb().collection(COLLECTIONS.familyLeaveRequests).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Leave form not found");
  const request = snap.data() as FamilyLeaveRequestSummary;
  if (status === "Approved" && !request.supervisor) {
    throw new Error("Select a supervisor before approving this leave request");
  }

  let attendanceLeave: AppliedLeaveAttendance | undefined;
  if (status === "Approved") {
    if (!isSalaamFamilyLeaveType(request.leaveType)) {
      throw new Error("Leave type is missing from this form");
    }
    // Forms from before the date-range picker only have the reported date (and maybe a second day).
    const startDate = request.leaveStartDate || request.requestDate;
    try {
      attendanceLeave = await applyApprovedLeaveToAttendance({
        employeeId: request.employeeId,
        leaveType: ATTENDANCE_LEAVE_TYPE[request.leaveType],
        startDate,
        endDate: request.leaveEndDate || request.secondDay?.date || startDate,
      });
    } catch (error) {
      return leaveAttendanceFailure(error);
    }
  } else {
    await revertApprovedLeaveFromAttendance(request.employeeId, request.attendanceLeave);
  }

  await ref.update({
    approvalStatus: status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewer.email || reviewer.name,
    attendanceLeave: attendanceLeave ?? FieldValue.delete(),
  });
  return { ok: true };
}
