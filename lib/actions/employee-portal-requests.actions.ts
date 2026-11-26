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
import {
  MAX_OVERTIME_MINUTES,
  MAX_OVERTIME_RANGES,
  rangeMinutes,
  rangesOverlap,
  sortRanges,
  totalRangeMinutes,
  type OvertimeTimeRange,
} from "@/lib/overtime/time-ranges";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function employeeForRequest(employeeId: string) {
  const profile = await getSessionAuthProfile();
  if (!profile && getEmployeeProfileSessionId() !== employeeId) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  return fetchEmployeeById(employeeId);
}

function validatedOvertime(input: {
  workDate: string;
  timeRanges: OvertimeTimeRange[];
  details: string;
}) {
  const workDate = String(input.workDate ?? "");
  const details = String(input.details ?? "").trim();
  const raw = Array.isArray(input.timeRanges) ? input.timeRanges : [];
  if (!validDate(workDate) || raw.length < 1 || raw.length > MAX_OVERTIME_RANGES) {
    throw new Error("Invalid overtime date or time");
  }
  const timeRanges = sortRanges(raw.map((range) => ({
    startTime: String(range?.startTime ?? ""),
    endTime: String(range?.endTime ?? ""),
  })));
  if (timeRanges.some((range) => !rangeMinutes(range))) throw new Error("Invalid overtime time");
  if (rangesOverlap(timeRanges)) throw new Error("Overtime times overlap");
  const durationMinutes = totalRangeMinutes(timeRanges) ?? 0;
  if (durationMinutes < 1 || durationMinutes > MAX_OVERTIME_MINUTES) {
    throw new Error("Invalid overtime duration");
  }
  if (details.length < 2 || details.length > 500) throw new Error("Invalid details");
  return {
    workDate,
    // The first start and last end, for views that show a single span.
    startTime: timeRanges[0].startTime,
    endTime: timeRanges[timeRanges.length - 1].endTime,
    timeRanges,
    details,
    durationMinutes,
  };
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
  timeRanges: OvertimeTimeRange[];
  details: string;
}): Promise<void> {
  const employeeId = String(input.employeeId ?? "").trim();
  const employee = await employeeForRequest(employeeId);
  await createOvertimeRequest({
    ...validatedOvertime(input),
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
  timeRanges: OvertimeTimeRange[];
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
