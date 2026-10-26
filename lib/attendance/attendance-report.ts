import { unstable_cache } from "next/cache";

import { reverseLeaveTypeMapping } from "@/constants";
import { leaveLabelToDhivehi } from "@/lib/attendance/mosque-sheet-leave";
import {
  ATTENDANCE_REPORT_GROUPS,
  MOSQUE_MIN_PRAYERS,
  compareReportColumns,
  type AttendanceReport,
  type AttendanceReportCell,
  type AttendanceReportDay,
  type AttendanceReportEmployee,
  type AttendanceReportGroupKey,
} from "@/lib/attendance/attendance-report-shared";
import { todayMaldivesIso, utcToMaldivesParts } from "@/lib/attendance-sync/time";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import {
  fetchAllEmployees,
  fetchAttendanceForMonth,
  fetchHolidayCalendar,
  fetchMosqueAttendanceForMonth,
  monthDateBounds,
} from "@/lib/firebase/hr";
import type { EmployeeDoc } from "@/lib/firebase/types";

const PRESCHOOL_DV = "ޕްރީސްކޫލް";
const MOSQUE_TIME_FIELDS = [
  "fathisSignInTime",
  "mendhuruSignInTime",
  "asuruSignInTime",
  "maqribSignInTime",
  "ishaSignInTime",
] as const;

/** Report group, or null for staff left out of the register (waste management, pre-school). */
function groupFor(employee: EmployeeDoc): AttendanceReportGroupKey | null {
  const section = (employee.section ?? "").trim().toLowerCase();
  if (section === "councillor" || section === "wdc") return "councillors";
  if (section === "mosque") return "mosque";
  if (section === "waste management" || section === "pre-school") return null;
  if (
    (employee.sectionDv ?? "").includes(PRESCHOOL_DV) ||
    (employee.designationDv ?? "").includes(PRESCHOOL_DV)
  ) {
    return null;
  }
  return "office";
}

function buildDays(month: string, holidays: ReadonlySet<string>): AttendanceReportDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
    return { day, iso, weekday, off: weekday === 5 || weekday === 6 || holidays.has(iso) };
  });
}

/** First eligible punch of each day in the month as Maldives "HH:mm", by employee and day. */
async function fetchFirstPunchesForMonth(
  month: string,
): Promise<Map<string, Map<number, string>>> {
  const { start, endExclusive } = monthDateBounds(month);
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .where("localDate", ">=", start)
    .where("localDate", "<", endExclusive)
    .select("employeeId", "localDate", "localTime", "timestampUtc", "eligible", "voidedAt")
    .get();

  const byEmployee = new Map<string, Map<number, string>>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const employeeId = typeof data.employeeId === "string" ? data.employeeId : "";
    if (!employeeId || data.eligible === false || data.voidedAt) continue;

    let time = typeof data.localTime === "string" ? data.localTime : "";
    if (!/^\d{2}:\d{2}$/.test(time) && isValidIso(data.timestampUtc)) {
      time = utcToMaldivesParts(data.timestampUtc).localTime;
    }
    if (!time) continue;

    const day = Number(String(data.localDate).slice(8, 10));
    const days = byEmployee.get(employeeId) ?? new Map<number, string>();
    const earliest = days.get(day);
    if (!earliest || time < earliest) days.set(day, time);
    byEmployee.set(employeeId, days);
  }
  return byEmployee;
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function cellFor(cells: Record<number, AttendanceReportCell>, day: number): AttendanceReportCell {
  cells[day] ??= { time: null, mark: null, leave: null };
  return cells[day];
}

function applyLeave(
  cell: AttendanceReportCell,
  leaveType: string | null | undefined,
  leaveUsedAfter: unknown,
) {
  const type = leaveType?.trim();
  if (!type) return;
  cell.leave = {
    type,
    labelDv: leaveLabelToDhivehi(reverseLeaveTypeMapping[type] ?? type),
    count: typeof leaveUsedAfter === "number" ? leaveUsedAfter : null,
  };
}

export async function buildAttendanceReport(month: string): Promise<AttendanceReport> {
  const { endExclusive } = monthDateBounds(month);
  const [employees, councilRows, mosqueRows, holidayCalendar, punches] = await Promise.all([
    fetchAllEmployees(),
    fetchAttendanceForMonth(month),
    fetchMosqueAttendanceForMonth(month),
    fetchHolidayCalendar(month),
    fetchFirstPunchesForMonth(month),
  ]);

  const days = buildDays(month, new Set(holidayCalendar?.holidayDates ?? []));
  const rows = new Map<string, AttendanceReportEmployee>();
  const groupOf = new Map<string, AttendanceReportGroupKey>();

  for (const employee of employees) {
    const joined = (employee.joinedDate ?? "").slice(0, 10);
    if (joined && joined >= endExclusive) continue;
    const group = groupFor(employee);
    if (!group) continue;
    groupOf.set(employee.$id, group);
    rows.set(employee.$id, {
      id: employee.$id,
      name: employee.name,
      nameDv: employee.nameDv?.trim() || employee.name,
      designationDv: employee.designationDv?.trim() || employee.designation?.trim() || "",
      joinedDate: joined,
      cells: {},
    });
  }

  for (const [employeeId, byDay] of punches) {
    const row = rows.get(employeeId);
    if (!row || groupOf.get(employeeId) === "mosque") continue;
    for (const [day, time] of byDay) {
      cellFor(row.cells, day).time = time;
    }
  }

  // Leave, plus the recorded sign-in for days the machine has no punch (fixed or manual sign-ins).
  for (const record of councilRows) {
    const row = rows.get(record.employeeId);
    if (!row) continue;
    const cell = cellFor(row.cells, Number(record.date.slice(8, 10)));
    applyLeave(cell, record.leaveType, record.leaveUsedAfter);
    if (!cell.time && isValidIso(record.signInTime)) {
      cell.time = utcToMaldivesParts(record.signInTime).localTime;
    }
  }

  // Mosque staff get a tick for signing in to enough prayers, otherwise absent.
  const prayersSigned = new Map<string, number>();
  for (const record of mosqueRows) {
    const row = rows.get(record.employeeId);
    if (!row || groupOf.get(record.employeeId) !== "mosque") continue;
    const day = Number(record.date.slice(8, 10));
    applyLeave(cellFor(row.cells, day), record.leaveType, record.leaveUsedAfter);
    const signed = MOSQUE_TIME_FIELDS.filter((field) => isValidIso(record[field])).length;
    const key = `${record.employeeId}:${day}`;
    prayersSigned.set(key, Math.max(prayersSigned.get(key) ?? 0, signed));
  }

  const today = todayMaldivesIso();
  for (const row of rows.values()) {
    if (groupOf.get(row.id) !== "mosque") continue;
    for (const day of days) {
      if (day.iso > today) break;
      const cell = cellFor(row.cells, day.day);
      cell.time = null;
      if (cell.leave) continue;
      const signed = prayersSigned.get(`${row.id}:${day.day}`) ?? 0;
      cell.mark = signed >= MOSQUE_MIN_PRAYERS ? "present" : "absent";
    }
  }

  return {
    month,
    days,
    groups: ATTENDANCE_REPORT_GROUPS.map(({ key, title }) => ({
      key,
      title,
      employees: Array.from(rows.values())
        .filter((row) => groupOf.get(row.id) === key)
        .sort(compareReportColumns),
    })),
  };
}

/** Month attendance report; cached briefly since a month of punches is a few thousand reads. */
export function fetchAttendanceReport(month: string): Promise<AttendanceReport> {
  return unstable_cache(
    () => buildAttendanceReport(month),
    ["attendance-report-v3", month],
    { revalidate: 300 },
  )();
}
