import {
  fetchAllEmployees,
  fetchAttendanceForDate as fetchAttendanceForDateHr,
  fetchMosqueAttendanceForDate as fetchMosqueAttendanceForDateHr,
} from "@/lib/firebase/hr";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";
import type { MosqueAttendanceRecord } from "@/types";

export type AttendanceEmployeeRef = {
  $id: string;
  name: string;
  section?: string;
};

export type MosqueAttendanceEmployeeRef = {
  $id: string;
  name: string;
  section: string;
  designation?: string;
};

export type EnrichedAttendanceRow = Omit<AttendanceDoc, "employeeId"> & {
  employeeId: string | AttendanceEmployeeRef;
};

/** Join attendance rows with employee name/section in one pass (2 Firestore reads total). */
export async function fetchEnrichedAttendanceForDate(
  date: string,
): Promise<EnrichedAttendanceRow[]> {
  const [rows, employees] = await Promise.all([
    fetchAttendanceForDateHr(date),
    fetchAllEmployees(),
  ]);

  const byId = new Map(employees.map((e) => [e.$id, e]));

  return rows.map((row) => {
    const emp = byId.get(row.employeeId);
    return {
      ...row,
      employeeId: emp
        ? { $id: emp.$id, name: emp.name, section: emp.section }
        : row.employeeId,
    };
  });
}

export type EnrichedMosqueAttendanceRow = MosqueAttendanceRecord;
export async function fetchEnrichedMosqueAttendanceForDate(
  date: string,
): Promise<MosqueAttendanceRecord[]> {
  const [rows, employees] = await Promise.all([
    fetchMosqueAttendanceForDateHr(date),
    fetchAllEmployees(),
  ]);

  const byId = new Map(employees.map((e) => [e.$id, e]));

  return rows.map((row): MosqueAttendanceRecord => {
    const emp = byId.get(row.employeeId);
    return {
      $id: row.$id,
      fathisSignInTime: row.fathisSignInTime,
      mendhuruSignInTime: row.mendhuruSignInTime,
      asuruSignInTime: row.asuruSignInTime,
      maqribSignInTime: row.maqribSignInTime,
      ishaSignInTime: row.ishaSignInTime,
      fathisMinutesLate: row.fathisMinutesLate,
      mendhuruMinutesLate: row.mendhuruMinutesLate,
      asuruMinutesLate: row.asuruMinutesLate,
      maqribMinutesLate: row.maqribMinutesLate,
      ishaMinutesLate: row.ishaMinutesLate,
      previousLeaveType: row.previousLeaveType ?? null,
      leaveDeducted: row.leaveDeducted ?? false,
      leaveType: row.leaveType,
      changed: row.changed ?? false,
      employeeId: emp
        ? {
            $id: emp.$id,
            name: emp.name,
            section: emp.section ?? "",
            designation: emp.designation,
          }
        : row.employeeId,
    };
  });
}

export function buildEmployeeLookup(
  employees: EmployeeDoc[],
): Record<string, { name: string; section?: string; designation?: string }> {
  const map: Record<
    string,
    { name: string; section?: string; designation?: string }
  > = {};
  for (const e of employees) {
    map[e.$id] = {
      name: e.name,
      section: e.section,
      designation: e.designation,
    };
  }
  return map;
}
