import "server-only";

import { listCouncilEmployees, listMachineEligibleEmployees } from "@/lib/attendance-sync/employee-sync";
import { EMPLOYEE_NAMES } from "@/constants";
import { computeCouncilMinutesLate } from "@/lib/attendance/council-lateness";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { fetchAllEmployees, fetchAttendanceForMonth, fetchHolidayCalendar } from "@/lib/firebase/hr";

export type CouncilMonthRow = {
  employeeId: string;
  name: string;
  designation: string;
  section: string;
  /** Signs in on the fingerprint machine or has a fixed sign-in time. */
  tracked: boolean;
  /** Days with a sign-in. */
  daysAttended: number;
  lateMinutes: number;
  lateDays: number;
  leaveDays: number;
};

export type CouncilMonthSummary = {
  month: string;
  /** Working days so far: weekdays that aren't public holidays, up to today. */
  workingDays: number;
  /** The last day counted, when the month isn't over yet. */
  countedThrough: string | null;
  rows: CouncilMonthRow[];
};

const nameKey = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
const ORDER = new Map(EMPLOYEE_NAMES.map((name, index) => [nameKey(name), index]));

function monthDates(month: string, until: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)
    .filter((date) => date <= until);
}

/** Each council employee's days at the office and late minutes for `month`. */
export async function buildCouncilMonthSummary(month: string): Promise<CouncilMonthSummary> {
  const today = maldivesTodayIso();
  const [employees, rows, holidays] = await Promise.all([
    fetchAllEmployees(),
    fetchAttendanceForMonth(month),
    fetchHolidayCalendar(month),
  ]);
  const holidayDates = new Set(holidays?.holidayDates ?? []);
  const dates = monthDates(month, today);
  const workingDays = dates.filter((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return weekday !== 5 && weekday !== 6 && !holidayDates.has(date);
  }).length;
  const lastDate = monthDates(month, "9999-12-31").at(-1) ?? `${month}-01`;
  const tracked = new Set(listMachineEligibleEmployees(employees, lastDate).map(({ employee }) => employee.$id));

  const byEmployee = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.date > today) continue;
    byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row]);
  }

  const summaryRows = listCouncilEmployees(employees).map((employee): CouncilMonthRow => {
    const own = byEmployee.get(employee.$id) ?? [];
    const attended = own.filter((row) => row.signInTime && !row.leaveType);
    // Worked out from the sign-in with today's rule (08:31 is 1 minute late):
    // some saved rows still carry minutes from an older rounding.
    const late = attended.map((row) => computeCouncilMinutesLate(row.signInTime!, row.date));
    return {
      employeeId: employee.$id,
      name: employee.name,
      designation: employee.designation ?? "",
      section: employee.section ?? "",
      tracked: tracked.has(employee.$id) || Boolean(employee.fixedSignInTime?.trim()),
      daysAttended: attended.length,
      lateMinutes: late.reduce((total, minutes) => total + minutes, 0),
      lateDays: late.filter((minutes) => minutes > 0).length,
      leaveDays: own.filter((row) => row.leaveType).length,
    };
  });

  summaryRows.sort((a, b) => {
    const ai = ORDER.get(nameKey(a.name)) ?? Number.MAX_SAFE_INTEGER;
    const bi = ORDER.get(nameKey(b.name)) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || a.name.localeCompare(b.name);
  });

  return {
    month,
    workingDays,
    countedThrough: lastDate > today ? today : null,
    rows: summaryRows,
  };
}
