import {
  getFirstPunchByDeviceUserId,
  getFirstPunchByEmployeeName,
} from "@/lib/attendance/punch-lookup";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";

export type CouncilAttendanceSyncResult = {
  synced: number;
  added: number;
};

export function isCouncilAttendanceEmployee(employee: EmployeeDoc): boolean {
  const section =
    typeof employee.section === "string" ? employee.section.trim().toLowerCase() : "";
  return section !== "mosque";
}

export async function buildCouncilAttendanceEntry(
  date: string,
  employee: EmployeeDoc,
): Promise<Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt">> {
  const firstPunch = employee.deviceUserId?.trim()
    ? await getFirstPunchByDeviceUserId(date, employee.deviceUserId.trim())
    : await getFirstPunchByEmployeeName(date, employee.name);

  return {
    employeeId: employee.$id,
    date,
    signInTime: firstPunch,
    leaveType: null,
    minutesLate: 0,
    previousLeaveType: null,
    leaveDeducted: false,
  };
}
