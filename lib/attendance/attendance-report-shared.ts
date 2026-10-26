import { EMPLOYEE_NAMES } from "@/constants";

/** Weekday names in Dhivehi, indexed by `Date#getUTCDay()`. */
export const DHIVEHI_WEEKDAYS = [
  "އާދިއްތަ",
  "ހޯމަ",
  "އަންގާރަ",
  "ބުދަ",
  "ބުރާސްފަތި",
  "ހުކުރު",
  "ހޮނިހިރު",
] as const;

export const DHIVEHI_MONTHS = [
  "ޖަނަވަރީ",
  "ފެބްރުއަރީ",
  "މާރޗް",
  "އޭޕްރިލް",
  "މޭ",
  "ޖޫން",
  "ޖުލައި",
  "އޯގަސްޓް",
  "ސެޕްޓެމްބަރ",
  "އޮކްޓޯބަރ",
  "ނޮވެމްބަރ",
  "ޑިސެމްބަރ",
] as const;

/** Sheets of the monthly "Muvazzafun ge Haaziree" workbook, in workbook order. */
export const ATTENDANCE_REPORT_GROUPS = [
  { key: "office", title: "Office Staffs" },
  { key: "councillors", title: "Councillors" },
  { key: "mosque", title: "Mosque" },
] as const;

export type AttendanceReportGroupKey =
  (typeof ATTENDANCE_REPORT_GROUPS)[number]["key"];

export type AttendanceReportLeave = {
  /** Backend leave key, e.g. "sickLeave". */
  type: string;
  labelDv: string;
  /** Running count of this leave after the day (leaveUsedAfter), when known. */
  count: number | null;
};

/** Mosque staff: signed in for at least this many of the five prayers counts as present. */
export const MOSQUE_MIN_PRAYERS = 3;

export const ABSENT_LABEL = "ހާޒިރުނުވޭ!";

export type AttendanceReportCell = {
  /** First punch of the day, Maldives wall-clock "HH:mm". Not used for mosque staff. */
  time: string | null;
  /** Mosque staff only: "present" (tick) or "absent" by prayers signed in. */
  mark: "present" | "absent" | null;
  leave: AttendanceReportLeave | null;
};

export type AttendanceReportEmployee = {
  id: string;
  name: string;
  nameDv: string;
  designationDv: string;
  joinedDate: string;
  /** Keyed by day of month. */
  cells: Record<number, AttendanceReportCell>;
};

export type AttendanceReportDay = {
  day: number;
  iso: string;
  weekday: number;
  /** Friday, Saturday or a holiday-calendar date. */
  off: boolean;
};

export type AttendanceReport = {
  month: string;
  days: AttendanceReportDay[];
  groups: Array<{
    key: AttendanceReportGroupKey;
    title: string;
    employees: AttendanceReportEmployee[];
  }>;
};

/** Employees printed per page; the day columns repeat after each block. */
export const EMPLOYEES_PER_PAGE = 7;

export function monthTitleDv(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${DHIVEHI_MONTHS[monthNumber - 1] ?? ""} ${year}`;
}

export function leaveCellText(leave: AttendanceReportLeave): string {
  return leave.count === null ? leave.labelDv : `${leave.labelDv} (${leave.count})`;
}

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");

/**
 * Column order of the paper sheet, first column (next to the day) first.
 * Office staff follow EMPLOYEE_NAMES, which already matches the sheet.
 */
const COLUMN_ORDER = [
  "Ibrahim Haleem",
  "Hussain Areef",
  "Hawwa Nazleena",
  "Fathimath Niha",
  "Ahmed Zahidh",
  "Mohamed Shahidh",
  "Mohamed Mahir",
  "Ibrahim Waseem",
  "Ibrahim Hashim",
  "Hawwa Luiza",
  "Buruhan",
  "Ubaidh",
  ...EMPLOYEE_NAMES,
];

const ORDER_INDEX = new Map<string, number>();
COLUMN_ORDER.forEach((name, index) => {
  const key = nameKey(name);
  if (!ORDER_INDEX.has(key)) ORDER_INDEX.set(key, index);
});

export function compareReportColumns(a: { name: string }, b: { name: string }): number {
  const ai = ORDER_INDEX.get(nameKey(a.name)) ?? Number.MAX_SAFE_INTEGER;
  const bi = ORDER_INDEX.get(nameKey(b.name)) ?? Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  return a.name.localeCompare(b.name);
}
