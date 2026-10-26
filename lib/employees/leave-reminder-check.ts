/** Server only. Finds the days employees still owe a leave form for. */
import { listMachineEligibleEmployees } from "@/lib/attendance-sync/employee-sync";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { fromFirestoreDocs } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import {
  fetchAllEmployees,
  fetchAttendanceForEmployeeRange,
  fetchEmployeeById,
  fetchHolidayCalendar,
  fetchMosqueAttendanceForEmployeeRange,
} from "@/lib/firebase/hr";
import type { AttendanceDoc, EmployeeDoc, MosqueAttendanceDoc } from "@/lib/firebase/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The longest range the missing forms list checks at once. */
export const MISSING_FORMS_MAX_DAYS = 31;

const PRAYER_SIGN_INS = [
  "fathisSignInTime",
  "mendhuruSignInTime",
  "asuruSignInTime",
  "maqribSignInTime",
  "ishaSignInTime",
] as const;

type RequestSpan = {
  employeeId: string;
  status: unknown;
  start: string;
  end: string;
};

export type MissingLeaveFormEmployee = {
  employeeId: string;
  name: string;
  designation: string;
  photoKey: string | null;
  /** Absent working days with no leave recorded or requested, oldest first. */
  dates: string[];
};

function isIsoDate(date: string): boolean {
  return DATE_PATTERN.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

function addDaysIso(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function isoSlice(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function familySpan(doc: FirebaseFirestore.QueryDocumentSnapshot): RequestSpan {
  const data = doc.data();
  const start = isoSlice(data.leaveStartDate || data.requestDate);
  return {
    employeeId: String(data.employeeId ?? ""),
    status: data.approvalStatus,
    start,
    end: isoSlice(data.leaveEndDate || data.requestDate) || start,
  };
}

function annualSpan(doc: FirebaseFirestore.QueryDocumentSnapshot): RequestSpan {
  const data = doc.data();
  const start = isoSlice(data.startDate);
  return {
    employeeId: String(data.employeeId ?? ""),
    status: data.approvalStatus,
    start,
    end: isoSlice(data.endDate) || start,
  };
}

/**
 * Whether one employee's day needs a leave form: they were absent on a working
 * day, taken on the fingerprint machine, with no leave recorded or requested.
 * `requests` are that employee's leave requests.
 */
function needsLeaveForm(args: {
  date: string;
  /** Signs in on the fingerprint machine that day, so a blank row means absent. */
  tracked: boolean;
  councilRow?: AttendanceDoc;
  mosqueRow?: MosqueAttendanceDoc;
  requests: RequestSpan[];
  holidayDates: string[];
}): boolean {
  const { date, councilRow, mosqueRow } = args;
  if (!args.tracked || (!councilRow && !mosqueRow)) return false;
  if (councilRow?.leaveType || mosqueRow?.leaveType) return false;
  const requested = args.requests.some(
    (request) => request.start && request.start <= date && date <= request.end && request.status !== "Rejected",
  );
  if (requested) return false;
  if (councilRow?.signInTime) return false;
  if (mosqueRow && PRAYER_SIGN_INS.some((field) => mosqueRow[field])) return false;
  // Mosque staff work every day; council staff are off on weekends and holidays.
  if (!mosqueRow) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 5 || weekday === 6 || args.holidayDates.includes(date)) return false;
  }
  return true;
}

/** Ids of employees whose attendance the fingerprint machines take on `date`. */
function trackedOn(employees: EmployeeDoc[], date: string): Set<string> {
  return new Set(listMachineEligibleEmployees(employees, date).map(({ employee }) => employee.$id));
}

/** The last `days` days up to yesterday: today isn't over yet. */
export function recentRange(days: number): { start: string; end: string } {
  const end = addDaysIso(maldivesTodayIso(), -1);
  return { start: addDaysIso(end, -(days - 1)), end };
}

/**
 * Everyone (or just `employeeId`) with absent days needing a leave form
 * between `start` and `end`, inclusive. Today is left out: they may still sign in.
 */
export async function findMissingLeaveForms(
  start: string,
  end: string,
  employeeId?: string,
): Promise<MissingLeaveFormEmployee[]> {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) throw new Error("Choose a valid date range");
  const lastDay = addDaysIso(maldivesTodayIso(), -1);
  const until = end < lastDay ? end : lastDay;
  if (start > until) return [];
  if (addDaysIso(start, MISSING_FORMS_MAX_DAYS) <= until) {
    throw new Error(`Choose ${MISSING_FORMS_MAX_DAYS} days or fewer`);
  }

  const months = new Set<string>();
  for (let date = start; date <= until; date = addDaysIso(date, 1)) months.add(date.slice(0, 7));

  const db = getFirestoreDb();
  const family = db.collection(COLLECTIONS.familyLeaveRequests);
  const annual = db.collection(COLLECTIONS.annualLeaveRequests);
  // One employee reads only their own rows; everyone reads each day's sheet once.
  const [employees, council, mosque, familySnap, annualSnap, ...holidays] = await Promise.all([
    employeeId ? fetchEmployeeById(employeeId).then((employee) => [employee]) : fetchAllEmployees(),
    employeeId
      ? fetchAttendanceForEmployeeRange(employeeId, start, addDaysIso(until, 1))
      : db.collection(COLLECTIONS.attendance).where("date", ">=", start).where("date", "<=", until).get()
        .then((snap) => fromFirestoreDocs<AttendanceDoc>(snap.docs)),
    employeeId
      ? fetchMosqueAttendanceForEmployeeRange(employeeId, start, addDaysIso(until, 1))
      : db.collection(COLLECTIONS.mosqueAttendance).where("date", ">=", start).where("date", "<=", until).get()
        .then((snap) => fromFirestoreDocs<MosqueAttendanceDoc>(snap.docs)),
    employeeId
      ? family.where("employeeId", "==", employeeId).get()
      // Family leave is asked for around the time it's taken, so a quarter back covers it.
      : family.where("requestDate", ">=", addDaysIso(start, -90)).get(),
    employeeId ? annual.where("employeeId", "==", employeeId).get() : annual.where("endDate", ">=", start).get(),
    ...[...months].map((month) => fetchHolidayCalendar(month)),
  ]);
  const holidayDates = holidays.flatMap((calendar) => calendar?.holidayDates ?? []);

  const rowsByEmployee = new Map<string, { council: Map<string, AttendanceDoc>; mosque: Map<string, MosqueAttendanceDoc> }>();
  const rowsFor = (id: string) => {
    let rows = rowsByEmployee.get(id);
    if (!rows) {
      rows = { council: new Map(), mosque: new Map() };
      rowsByEmployee.set(id, rows);
    }
    return rows;
  };
  for (const row of council) rowsFor(row.employeeId).council.set(row.date, row);
  for (const row of mosque) rowsFor(row.employeeId).mosque.set(row.date, row);

  const requests = [...familySnap.docs.map(familySpan), ...annualSnap.docs.map(annualSpan)];
  const trackedByDate = new Map<string, Set<string>>();
  for (let date = start; date <= until; date = addDaysIso(date, 1)) trackedByDate.set(date, trackedOn(employees, date));
  const result: MissingLeaveFormEmployee[] = [];
  for (const employee of employees) {
    const rows = rowsByEmployee.get(employee.$id);
    if (!rows) continue;
    const ownRequests = requests.filter((request) => request.employeeId === employee.$id);
    const dates: string[] = [];
    for (let date = start; date <= until; date = addDaysIso(date, 1)) {
      const day = {
        date,
        tracked: trackedByDate.get(date)!.has(employee.$id),
        councilRow: rows.council.get(date),
        mosqueRow: rows.mosque.get(date),
        requests: ownRequests,
        holidayDates,
      };
      if (needsLeaveForm(day)) dates.push(date);
    }
    if (!dates.length) continue;
    result.push({
      employeeId: employee.$id,
      name: typeof employee.name === "string" ? employee.name : "Unknown",
      designation: typeof employee.designation === "string" ? employee.designation : "",
      photoKey: typeof employee.photoKey === "string" ? employee.photoKey : null,
      dates,
    });
  }
  return result.sort((a, b) => b.dates.length - a.dates.length || a.name.localeCompare(b.name));
}
