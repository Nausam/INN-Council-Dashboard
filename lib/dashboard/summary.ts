"use server";

import {
  computeCouncilMinutesLate,
  resolveSectionForLateness,
} from "@/lib/attendance/council-lateness";
import {
  fetchAllEmployees,
  fetchAttendanceForDate,
  fetchMosqueAttendanceForDate,
} from "@/lib/firebase/hr";

type EmployeeInfo = {
  name: string;
  section?: string;
  designation?: string;
};

export type DashboardSummary = {
  totalEmployees: number;
  onTime: number;
  late: number;
  absent: number;
  hasAttendance: boolean;
  absentEmployees: Array<{ name: string; leaveType?: string | null }>;
  lateEmployees: Array<{
    name: string;
    designation?: string;
    minutesLate: number;
  }>;
};

const emptySummary: DashboardSummary = {
  totalEmployees: 0,
  onTime: 0,
  late: 0,
  absent: 0,
  hasAttendance: false,
  absentEmployees: [],
  lateEmployees: [],
};

export async function fetchDashboardSummary(
  date: string,
): Promise<DashboardSummary> {
  if (!date) return emptySummary;

  const [employees, officeAttendance, mosqueAttendance] = await Promise.all([
    fetchAllEmployees(),
    fetchAttendanceForDate(date),
    fetchMosqueAttendanceForDate(date),
  ]);

  const employeeById = new Map<string, EmployeeInfo>();
  for (const employee of employees) {
    employeeById.set(employee.$id, {
      name: employee.name ?? "Unknown",
      section: employee.section,
      designation: employee.designation,
    });
  }

  const resolveName = (employeeId: string, fallback?: string | null) =>
    fallback?.trim() ||
    employeeById.get(employeeId)?.name ||
    employeeId ||
    "Unknown";

  const hasAttendance =
    officeAttendance.length > 0 || mosqueAttendance.length > 0;

  if (!hasAttendance) {
    return {
      ...emptySummary,
      totalEmployees: employees.length,
    };
  }

  const absentSet = new Set<string>();
  const absentEmployees: DashboardSummary["absentEmployees"] = [];

  for (const row of officeAttendance) {
    if (!row.leaveType) continue;
    const name = resolveName(
      row.employeeId,
      (row as { employeeName?: string | null }).employeeName,
    );
    if (absentSet.has(name)) continue;
    absentSet.add(name);
    absentEmployees.push({ name, leaveType: row.leaveType });
  }

  const lateMap = new Map<string, DashboardSummary["lateEmployees"][number]>();

  for (const row of officeAttendance) {
    const employee = employeeById.get(row.employeeId);
    const name = resolveName(
      row.employeeId,
      (row as { employeeName?: string | null }).employeeName,
    );
    const minutesLate = row.signInTime
      ? computeCouncilMinutesLate(
          row.signInTime,
          date,
          resolveSectionForLateness(employee?.section, employee?.designation),
        )
      : Number(row.minutesLate ?? 0);

    if (!absentSet.has(name) && minutesLate > 0) {
      lateMap.set(name, {
        name,
        designation: employee?.designation,
        minutesLate,
      });
    }
  }

  for (const row of mosqueAttendance) {
    const employee = employeeById.get(row.employeeId);
    const name = resolveName(
      row.employeeId,
      (row as { employeeName?: string | null }).employeeName,
    );
    const minutesLate = Math.max(
      Number(row.fathisMinutesLate ?? 0),
      Number(row.mendhuruMinutesLate ?? 0),
      Number(row.asuruMinutesLate ?? 0),
      Number(row.maqribMinutesLate ?? 0),
      Number(row.ishaMinutesLate ?? 0),
    );

    if (!absentSet.has(name) && minutesLate > 0) {
      lateMap.set(name, {
        name,
        designation: employee?.designation,
        minutesLate,
      });
    }
  }

  const lateEmployees = Array.from(lateMap.values()).sort(
    (a, b) => b.minutesLate - a.minutesLate,
  );
  const absent = absentSet.size;
  const late = lateEmployees.length;

  return {
    totalEmployees: employees.length,
    onTime: Math.max(0, employees.length - absent - late),
    late,
    absent,
    hasAttendance,
    absentEmployees,
    lateEmployees,
  };
}
