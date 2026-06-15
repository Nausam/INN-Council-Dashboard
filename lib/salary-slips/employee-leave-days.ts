import { reverseLeaveTypeMapping } from "@/constants";
import {
  getLeaveUsageSummary,
  type LeaveUsageSummary,
} from "@/lib/employees/leave-usage";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";
import {
  getPayPeriodBounds,
  isOnAttendanceLeave,
} from "@/lib/salary-slips/pay-period";

export type EmployeeLeaveDayInfo = {
  date: string;
  leaveType: string;
  leaveLabel: string;
  usage: LeaveUsageSummary;
};

function leaveBalance(employee: EmployeeDoc, leaveType: string): number {
  const raw = employee[leaveType as keyof EmployeeDoc];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export function buildEmployeeLeaveDays(
  employee: EmployeeDoc,
  attendanceRows: AttendanceDoc[],
  periodLabel: string,
): EmployeeLeaveDayInfo[] {
  const bounds = getPayPeriodBounds(periodLabel);
  const employeeId = employee.$id;
  const byDate = new Map<string, EmployeeLeaveDayInfo>();

  for (const row of attendanceRows) {
    if (row.employeeId !== employeeId) continue;

    const leaveType = row.leaveType?.trim() ?? "";
    if (!isOnAttendanceLeave(leaveType)) continue;

    const date = row.date?.trim() ?? "";
    if (!date) continue;
    if (
      bounds &&
      (date < bounds.startIso || date > bounds.endIso)
    ) {
      continue;
    }

    const leaveLabel =
      reverseLeaveTypeMapping[leaveType] ??
      leaveType.replace(/([A-Z])/g, " $1").trim();

    byDate.set(date, {
      date,
      leaveType,
      leaveLabel,
      usage: getLeaveUsageSummary(leaveType, leaveBalance(employee, leaveType)),
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function employeeLeaveDaysMap(
  days: EmployeeLeaveDayInfo[],
): Map<string, EmployeeLeaveDayInfo> {
  return new Map(days.map((day) => [day.date, day]));
}

export function formatLeaveUsageCompact(usage: LeaveUsageSummary): string {
  if (usage.remaining !== null) {
    return `${usage.used} used · ${usage.remaining} left`;
  }
  return `${usage.used} used`;
}

export function shortLeaveLabel(label: string): string {
  const word = label.split(/\s+/)[0] ?? label;
  if (word.length <= 10) return word;
  return `${word.slice(0, 9)}…`;
}
