"use server";

import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { recordCardLabelForEmployee } from "@/lib/employees/record-card-label";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import {
  createOvertimeRequest,
  fetchEmployeeById,
} from "@/lib/firebase/hr";
import type { OvertimeRequest } from "@/lib/firebase/types";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function minutesFromTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function employeeForRequest(employeeId: string) {
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  return fetchEmployeeById(employeeId);
}

function validatedOvertime(input: {
  workDate: string;
  startTime: string;
  endTime: string;
  details: string;
}) {
  const workDate = String(input.workDate ?? "");
  const startTime = String(input.startTime ?? "");
  const endTime = String(input.endTime ?? "");
  const details = String(input.details ?? "").trim();
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (!validDate(workDate) || start === null || end === null || start === end) {
    throw new Error("Invalid overtime date or time");
  }
  const durationMinutes = (end - start + 1_440) % 1_440;
  if (durationMinutes < 1 || durationMinutes > 16 * 60) {
    throw new Error("Invalid overtime duration");
  }
  if (details.length < 2 || details.length > 500) throw new Error("Invalid details");
  return { workDate, startTime, endTime, details, durationMinutes };
}

/** An employee may edit a pending OT request only when it is theirs alone. */
function isOwnPendingOvertime(request: OvertimeRequest | undefined, employeeId: string): boolean {
  return Boolean(
    request &&
    request.employees?.length === 1 &&
    request.employees[0]?.employeeId === employeeId &&
    request.approvalStatus !== "Approved" &&
    request.approvalStatus !== "Rejected",
  );
}

export async function submitEmployeeOvertimeRequest(input: {
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  details: string;
}): Promise<void> {
  const employeeId = String(input.employeeId ?? "").trim();
  const employee = await employeeForRequest(employeeId);
  const { workDate, startTime, endTime, details, durationMinutes } = validatedOvertime(input);

  await createOvertimeRequest({
    workDate,
    details,
    startTime,
    endTime,
    durationMinutes,
    employees: [
      {
        employeeId,
        name: employee.name,
        designation: employee.designation,
        section: employee.section,
        recordCardNumber: employee.recordCardNumber,
        recordCardLabel: recordCardLabelForEmployee(employee.section, employee.designation),
        address: employee.address,
        joinedDate: employee.joinedDate,
      },
    ],
  });
}

export async function updateEmployeeOvertimeRequest(input: {
  employeeId: string;
  requestId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  details: string;
}): Promise<{ ok: true } | { ok: false; code: "not_editable" }> {
  const employeeId = String(input.employeeId ?? "").trim();
  const requestId = String(input.requestId ?? "").trim();
  await employeeForRequest(employeeId);
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const changes = validatedOvertime(input);

  const db = getFirestoreDb();
  const requestRef = db.collection(COLLECTIONS.overtimeRequests).doc(requestId);
  return db.runTransaction(async (transaction) => {
    const current = (await transaction.get(requestRef)).data() as OvertimeRequest | undefined;
    if (!isOwnPendingOvertime(current, employeeId)) return { ok: false, code: "not_editable" } as const;
    transaction.update(requestRef, { ...changes, updatedAt: new Date() });
    return { ok: true } as const;
  });
}
