import "server-only";

import { listCouncilEmployees, listMachineEligibleEmployees } from "@/lib/attendance-sync/employee-sync";
import { EMPLOYEE_NAMES } from "@/constants";
import { computeCouncilMinutesLate } from "@/lib/attendance/council-lateness";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { fromFirestoreDocs } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees, fetchHolidayDatesBetween } from "@/lib/firebase/hr";
import type { AttendanceDoc } from "@/lib/firebase/types";

/** The longest range the report counts at once. */
export const COUNCIL_REPORT_MAX_DAYS = 366;

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
  /** Each late day, oldest first. */
  lateDates: Array<{ date: string; signInTime: string; minutes: number }>;
  leaveDays: number;
};

export type CouncilMonthSummary = {
  /** The range asked for, inclusive. */
  start: string;
  end: string;
  /** Working days so far: weekdays that aren't public holidays, up to today. */
  workingDays: number;
  /** The last day counted, when the range runs past today. */
  countedThrough: string | null;
  rows: CouncilMonthRow[];
  error?: string;
};

const nameKey = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
const ORDER = new Map(EMPLOYEE_NAMES.map((name, index) => [nameKey(name), index]));

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** First and last day of a `YYYY-MM` month. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/**
 * Each council employee's days at the office and late minutes between
 * `start` and `end` (inclusive). Days after today aren't counted yet.
 */
export async function buildCouncilMonthSummary(start: string, end: string): Promise<CouncilMonthSummary> {
  const empty = { start, end, workingDays: 0, countedThrough: null, rows: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return { ...empty, error: "Choose a valid date range." };
  }
  if (addDays(start, COUNCIL_REPORT_MAX_DAYS) <= end) {
    return { ...empty, error: `Choose ${COUNCIL_REPORT_MAX_DAYS} days or fewer.` };
  }
  const today = maldivesTodayIso();
  const until = end < today ? end : today;

  const [employees, rows, holidays] = await Promise.all([
    fetchAllEmployees(),
    start <= until
      ? getFirestoreDb()
          .collection(COLLECTIONS.attendance)
          .where("date", ">=", start)
          .where("date", "<=", until)
          .get()
          .then((snap) => fromFirestoreDocs<AttendanceDoc>(snap.docs))
      : Promise.resolve([] as AttendanceDoc[]),
    start <= until ? fetchHolidayDatesBetween(start, until) : Promise.resolve([] as string[]),
  ]);
  const holidayDates = new Set(holidays);
  const workingDays = (start <= until ? datesBetween(start, until) : []).filter((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return weekday !== 5 && weekday !== 6 && !holidayDates.has(date);
  }).length;
  const tracked = new Set(listMachineEligibleEmployees(employees, end).map(({ employee }) => employee.$id));

  const byEmployee = new Map<string, AttendanceDoc[]>();
  for (const row of rows) {
    byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row]);
  }

  const summaryRows = listCouncilEmployees(employees).map((employee): CouncilMonthRow => {
    const own = byEmployee.get(employee.$id) ?? [];
    const attended = own.filter((row) => row.signInTime && !row.leaveType);
    // Worked out from the sign-in with today's rule (08:31 is 1 minute late),
    // rather than trusting minutes saved under older rules.
    const late = attended.map((row) => computeCouncilMinutesLate(row.signInTime!, row.date));
    const lateDates = attended
      .map((row, index) => ({ date: row.date, signInTime: row.signInTime!, minutes: late[index] }))
      .filter((day) => day.minutes > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      employeeId: employee.$id,
      name: employee.name,
      designation: employee.designation ?? "",
      section: employee.section ?? "",
      tracked: tracked.has(employee.$id) || Boolean(employee.fixedSignInTime?.trim()),
      daysAttended: attended.length,
      lateMinutes: late.reduce((total, minutes) => total + minutes, 0),
      lateDays: lateDates.length,
      lateDates,
      leaveDays: own.filter((row) => row.leaveType).length,
    };
  });

  summaryRows.sort((a, b) => {
    const ai = ORDER.get(nameKey(a.name)) ?? Number.MAX_SAFE_INTEGER;
    const bi = ORDER.get(nameKey(b.name)) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || a.name.localeCompare(b.name);
  });

  return {
    start,
    end,
    workingDays,
    countedThrough: end > today ? today : null,
    rows: summaryRows,
  };
}
