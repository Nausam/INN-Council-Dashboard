import type { AttendanceDoc, EmployeeDoc, MosqueAttendanceDoc } from "@/lib/firebase/types";
import type { EmployeeLeaveCalendarEntry } from "@/lib/firebase/types";
import { maldivesDateTime } from "@/lib/dates/maldives";
import {
  ADDITIVE_LEAVE_KEYS,
  LEAVE_TOTAL_ALLOWANCE,
  getLeaveUsageSummary,
} from "@/lib/employees/leave-usage";

export type EmployeeDetailsView = {
  id: string;
  name: string;
  designation: string;
  section: string;
  joinedDate: string;
  address: string;
  recordCardNumber: string;
  deviceUserId: string;
  leaveBalances: LeaveBalanceView[];
  payItems: PayItemView[];
  creditSchemes: CreditSchemeView[];
};

export type LeaveBalanceView = {
  key: string;
  label: string;
  used: number;
  remaining: number | null;
  allowance: number | null;
};

export type PayItemView = {
  key: string;
  label: string;
  value: number;
};

export type CreditSchemeView = {
  name: string;
  startDate: string;
  endDate: string;
  startMonthAmount: number;
  endMonthAmount: number;
};

export type WeekDayAttendance = {
  date: string;
  label: string;
  day: string;
  status: "present" | "late" | "leave" | "absent";
  source: "Council" | "Mosque" | "None";
  note: string;
  signInTime: string | null;
  lateMinutes: number;
  leaveType: string | null;
};

export type AttendanceSummary = {
  presentDays: number;
  lateMinutes: number;
  leaveDaysThisMonth: number;
  weekDays: WeekDayAttendance[];
};

const LEAVE_FIELDS = [
  ["sickLeave", "Sick Leave"],
  ["certificateSickLeave", "Certificate Sick Leave"],
  ["annualLeave", "Annual Leave"],
  ["familyRelatedLeave", "Family Related Leave"],
  ["preMaternityLeave", "Pre-Maternity Leave"],
  ["maternityLeave", "Maternity Leave"],
  ["paternityLeave", "Paternity Leave"],
  ["noPayLeave", "No Pay Leave"],
  ["officialLeave", "Official Leave"],
] as const;

const PAY_FIELDS = [
  ["basicSalary", "Basic Salary"],
  ["retirementPension", "Retirement Pension"],
  ["jobAllowance", "Job Allowance"],
  ["attendanceBenefit", "Attendance Benefit"],
  ["temporaryZvAllowance", "Temporary ZV Allowance"],
  ["ramazanAllowance", "Ramazan Allowance"],
  ["livingAllowance", "Living Allowance"],
  ["foodAllowance", "Food Allowance"],
  ["phoneAllowance", "Phone Allowance"],
] as const;

const PRAYER_TIME_FIELDS = [
  "fathisSignInTime",
  "mendhuruSignInTime",
  "asuruSignInTime",
  "maqribSignInTime",
  "ishaSignInTime",
] as const;

const PRAYER_LATE_FIELDS = [
  "fathisMinutesLate",
  "mendhuruMinutesLate",
  "asuruMinutesLate",
  "maqribMinutesLate",
  "ishaMinutesLate",
] as const;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function employeeIdFromDoc(employee: EmployeeDoc): string {
  const candidate = (employee as Record<string, unknown>).$id;
  return typeof candidate === "string" ? candidate : "";
}

// Dates are worked out as Maldives calendar days, so the server and the phone
// render the same page whatever timezone each one runs in.

/** Today's Maldives date as YYYY-MM-DD. */
export function maldivesTodayIso(now = new Date()): string {
  return maldivesDateTime(now).date;
}

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso: string, days: number): string {
  const date = isoToUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Sunday that starts the work week containing `iso`. */
function weekStartIso(iso: string): string {
  return addDaysIso(iso, -isoToUtcDate(iso).getUTCDay());
}

/** First day of the previous work week, the earliest date "Last week" shows. */
export function lastWeekStartIso(todayIso: string): string {
  return addDaysIso(weekStartIso(todayIso), -7);
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Indian/Maldives",
  });
}

export function formatDateLabel(value: string): string {
  if (!value) return "Not specified";
  const instant = value.includes("T");
  const parsed = new Date(instant ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: instant ? "Indian/Maldives" : "UTC",
  });
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MVR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function leaveLabel(leaveType: string | null | undefined): string {
  if (!leaveType) return "";
  const found = LEAVE_FIELDS.find(([key]) => key === leaveType);
  return found?.[1] ?? leaveType;
}

export function toEmployeeDetailsView(employee: EmployeeDoc): EmployeeDetailsView {
  const record = employee as Record<string, unknown>;
  const creditSchemes = Array.isArray(employee.creditSchemes)
    ? employee.creditSchemes
        .filter(isRecord)
        .map((scheme) => ({
          name: str(scheme.name, "Credit Scheme"),
          startDate: str(scheme.startDate),
          endDate: str(scheme.endDate),
          startMonthAmount: num(scheme.startMonthAmount),
          endMonthAmount: num(scheme.endMonthAmount),
        }))
    : [];

  return {
    id: employeeIdFromDoc(employee),
    name: str(employee.name, "Unknown"),
    designation: str(employee.designation),
    section: str(employee.section),
    joinedDate: str(employee.joinedDate),
    address: str(employee.address),
    recordCardNumber: str(employee.recordCardNumber),
    deviceUserId: str(employee.deviceUserId),
    leaveBalances: LEAVE_FIELDS.map(([key, label]) => {
      const balance = num(record[key]);
      const usage = getLeaveUsageSummary(key, balance);
      return {
        key,
        label,
        used: usage.used,
        remaining: usage.remaining,
        allowance: LEAVE_TOTAL_ALLOWANCE[key] ?? null,
      };
    }),
    payItems: PAY_FIELDS.map(([key, label]) => ({
      key,
      label,
      value: num(record[key]),
    })).filter((item) => item.value > 0),
    creditSchemes,
  };
}

/** Council work week: Sunday to Thursday. Friday and Saturday are the weekend. */
export const WORK_WEEK_DAYS = 5;

type AttendanceSources = {
  employeeId: string;
  councilAttendance: AttendanceDoc[];
  mosqueAttendance: MosqueAttendanceDoc[];
  leaves: EmployeeLeaveCalendarEntry[];
  today?: Date;
};

function dayLabels(iso: string): { label: string; day: string } {
  const date = isoToUtcDate(iso);
  return {
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    day: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
  };
}

/** Builds one entry per day from `startIso`, using council, mosque, and leave records. */
function buildAttendanceDays(args: AttendanceSources, startIso: string, count: number): WeekDayAttendance[] {
  const councilByDate = new Map(
    args.councilAttendance
      .filter((row) => row.employeeId === args.employeeId)
      .map((row) => [row.date, row]),
  );
  const mosqueByDate = new Map(args.mosqueAttendance.map((row) => [row.date, row]));
  const leavesByDate = new Map(
    args.leaves.map((entry) => [entry.date, entry.leaveType]),
  );

  return Array.from({ length: count }, (_, index): WeekDayAttendance => {
    const iso = addDaysIso(startIso, index);
    const labels = dayLabels(iso);
    const council = councilByDate.get(iso);
    const mosque = mosqueByDate.get(iso);
    const leaveType = council?.leaveType ?? mosque?.leaveType ?? leavesByDate.get(iso) ?? null;

    if (council) {
      const lateMinutes = Math.max(0, num(council.minutesLate));
      const signInTime = formatTime(council.signInTime);
      return {
        date: iso,
        ...labels,
        status: leaveType ? "leave" : lateMinutes > 0 ? "late" : signInTime ? "present" : "absent",
        source: "Council",
        note: leaveType ? leaveLabel(leaveType) : signInTime ? `In ${signInTime}` : "No sign-in",
        signInTime,
        lateMinutes,
        leaveType,
      } satisfies WeekDayAttendance;
    }

    if (mosque) {
      const lateMinutes = PRAYER_LATE_FIELDS.reduce(
        (total, field) => total + Math.max(0, num(mosque[field])),
        0,
      );
      const firstSignIn =
        PRAYER_TIME_FIELDS.map((field) => formatTime(mosque[field])).find(Boolean) ?? null;
      return {
        date: iso,
        ...labels,
        status: leaveType ? "leave" : lateMinutes > 0 ? "late" : firstSignIn ? "present" : "absent",
        source: "Mosque",
        note: leaveType ? leaveLabel(leaveType) : firstSignIn ? `First ${firstSignIn}` : "No prayer sign-in",
        signInTime: firstSignIn,
        lateMinutes,
        leaveType,
      } satisfies WeekDayAttendance;
    }

    return {
      date: iso,
      ...labels,
      status: leaveType ? "leave" : "absent",
      source: "None",
      note: leaveType ? leaveLabel(leaveType) : "No record",
      signInTime: null,
      lateMinutes: 0,
      leaveType,
    } satisfies WeekDayAttendance;
  });
}

export function buildAttendanceSummary(args: AttendanceSources): AttendanceSummary {
  const todayIso = maldivesTodayIso(args.today);
  const currentMonth = todayIso.slice(0, 7);
  const weekDays = buildAttendanceDays(args, weekStartIso(todayIso), WORK_WEEK_DAYS);

  return {
    weekDays,
    presentDays: weekDays.filter((day) => day.status === "present" || day.status === "late").length,
    lateMinutes: weekDays.reduce((total, day) => total + day.lateMinutes, 0),
    leaveDaysThisMonth: args.leaves.filter((entry) => entry.date.startsWith(currentMonth)).length,
  };
}

/** The previous work week, Sunday to Thursday. */
export function buildLastWeekAttendance(args: AttendanceSources): WeekDayAttendance[] {
  return buildAttendanceDays(args, lastWeekStartIso(maldivesTodayIso(args.today)), WORK_WEEK_DAYS);
}

export function currentLimitedLeaveRemaining(employee: EmployeeDetailsView, key: string): number {
  return employee.leaveBalances.find((item) => item.key === key)?.remaining ?? 0;
}

export function isAdditiveLeave(key: string): boolean {
  return ADDITIVE_LEAVE_KEYS.has(key);
}
