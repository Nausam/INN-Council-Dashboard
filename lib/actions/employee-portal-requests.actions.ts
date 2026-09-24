"use server";

import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { recordCardLabelForEmployee } from "@/lib/employees/record-card-label";
import {
  createAnnualLeaveRequest,
  createOvertimeRequest,
  fetchEmployeeById,
} from "@/lib/firebase/hr";

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
  if (!profile) throw new Error("Unauthorized");
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  return fetchEmployeeById(employeeId);
}

export async function submitEmployeeAnnualLeaveRequest(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}): Promise<void> {
  const employeeId = String(input.employeeId ?? "").trim();
  const employee = await employeeForRequest(employeeId);
  const startDate = String(input.startDate ?? "");
  const endDate = String(input.endDate ?? "");
  const reason = String(input.reason ?? "").trim();
  const totalDays = Number(input.totalDays);
  if (!validDate(startDate) || !validDate(endDate)) throw new Error("Invalid dates");
  const span =
    (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000 +
    1;
  if (span < 1 || span > 366 || !Number.isInteger(totalDays) || totalDays < 1 || totalDays > span) {
    throw new Error("Invalid number of leave days");
  }
  if (reason.length < 2 || reason.length > 500) throw new Error("Invalid reason");

  await createAnnualLeaveRequest({
    fullName: employee.name,
    reason,
    totalDays,
    startDate,
    endDate,
  });
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
