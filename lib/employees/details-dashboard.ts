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

/**
 * Mosque sign-ins are stored with the Maldives wall clock written as UTC
 * (a 4:21 AM sign-in is "…T04:21:00.000Z"), so they're read back in UTC.
 */
export function formatMosqueSignIn(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
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
        PRAYER_TIME_FIELDS.map((field) => formatMosqueSignIn(mosque[field])).find(Boolean) ?? null;
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

/* ---------------- Mosque staff: five prayers a day ---------------- */

/** The five daily prayers, in order, with their fields on a mosque attendance record. */
export const MOSQUE_PRAYERS = [
  { key: "fathis", label: "Fathis", signInField: "fathisSignInTime", lateField: "fathisMinutesLate" },
  { key: "mendhuru", label: "Mendhuru", signInField: "mendhuruSignInTime", lateField: "mendhuruMinutesLate" },
  { key: "asuru", label: "Asuru", signInField: "asuruSignInTime", lateField: "asuruMinutesLate" },
  { key: "maqrib", label: "Magrib", signInField: "maqribSignInTime", lateField: "maqribMinutesLate" },
  { key: "isha", label: "Isha", signInField: "ishaSignInTime", lateField: "ishaMinutesLate" },
] as const;

export type MosquePrayerKey = (typeof MOSQUE_PRAYERS)[number]["key"];

/** Scheduled prayer times by YYYY-MM-DD date, each as 24-hour "HH:MM". */
export type PrayerSchedule = Record<string, Record<MosquePrayerKey, string>>;

/** Mosque staff sign in for prayers every day of the week. */
export const MOSQUE_WEEK_DAYS = 7;

/** Lateness stops counting this long after a prayer, so a later gap is a missed prayer. */
const PRAYER_WINDOW_MINUTES = 64;

export type PrayerSlotStatus = "onTime" | "late" | "missed" | "due" | "upcoming" | "leave";

export type PrayerSlot = {
  key: MosquePrayerKey;
  label: string;
  /** "4:41 AM", or null when the day's times aren't known. */
  scheduled: string | null;
  /** When they're expected in: the prayer time less their grace minutes. */
  expectedBy: string | null;
  signInTime: string | null;
  lateMinutes: number;
  status: PrayerSlotStatus;
};

export type PrayerDayStatus = "present" | "late" | "leave" | "absent" | "pending" | "upcoming";

export type PrayerDay = {
  date: string;
  label: string;
  day: string;
  status: PrayerDayStatus;
  note: string;
  leaveType: string | null;
  prayers: PrayerSlot[];
  /** Prayers signed in for. */
  attended: number;
  /** Prayers that have already come round (not on leave, not still ahead). */
  due: number;
  lateMinutes: number;
};

export type MosqueWeekSummary = {
  days: PrayerDay[];
  attended: number;
  due: number;
  lateMinutes: number;
  latePrayers: number;
};

function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes from midnight as "4:41 AM". */
export function minutesToClock(total: number): string {
  const minutes = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/** Current Maldives time as minutes from midnight. */
function maldivesNowMinutes(now = new Date()): number {
  return hhmmToMinutes(maldivesDateTime(now).time) ?? 0;
}

type MosqueDaySources = {
  mosqueAttendance: MosqueAttendanceDoc[];
  leaves: EmployeeLeaveCalendarEntry[];
  schedule: PrayerSchedule;
  /** Minutes before each prayer they're expected in (5 for an Imam). */
  graceMinutes: number;
  today?: Date;
};

function buildPrayerDays(args: MosqueDaySources, startIso: string, count: number): PrayerDay[] {
  const todayIso = maldivesTodayIso(args.today);
  const nowMinutes = maldivesNowMinutes(args.today);
  const recordByDate = new Map(args.mosqueAttendance.map((row) => [row.date, row]));
  const leaveByDate = new Map(args.leaves.map((entry) => [entry.date, entry.leaveType]));

  return Array.from({ length: count }, (_, index): PrayerDay => {
    const iso = addDaysIso(startIso, index);
    const record = recordByDate.get(iso);
    const times = args.schedule[iso];
    const leaveType = record?.leaveType ?? leaveByDate.get(iso) ?? null;

    const prayers = MOSQUE_PRAYERS.map((prayer): PrayerSlot => {
      const scheduledMinutes = times ? hhmmToMinutes(times[prayer.key]) : null;
      const signInTime = formatMosqueSignIn(record?.[prayer.signInField])?.replace(/^0/, "") ?? null;
      const lateMinutes = Math.max(0, num(record?.[prayer.lateField]));
      let status: PrayerSlotStatus;
      if (leaveType) status = "leave";
      else if (signInTime) status = lateMinutes > 0 ? "late" : "onTime";
      else if (iso > todayIso) status = "upcoming";
      else if (iso < todayIso) status = "missed";
      else if (scheduledMinutes === null) status = "due";
      else if (nowMinutes < scheduledMinutes - args.graceMinutes) status = "upcoming";
      else if (nowMinutes < scheduledMinutes + PRAYER_WINDOW_MINUTES) status = "due";
      else status = "missed";

      return {
        key: prayer.key,
        label: prayer.label,
        scheduled: scheduledMinutes === null ? null : minutesToClock(scheduledMinutes),
        expectedBy: scheduledMinutes === null ? null : minutesToClock(scheduledMinutes - args.graceMinutes),
        signInTime,
        lateMinutes: signInTime ? lateMinutes : 0,
        status,
      };
    });

    const attended = prayers.filter((p) => p.status === "onTime" || p.status === "late").length;
    const due = prayers.filter((p) => p.status !== "upcoming" && p.status !== "leave").length;
    const lateMinutes = prayers.reduce((total, p) => total + p.lateMinutes, 0);
    const status: PrayerDayStatus = leaveType
      ? "leave"
      : iso > todayIso
        ? "upcoming"
        : attended > 0
          ? lateMinutes > 0 ? "late" : "present"
          : iso === todayIso && prayers.some((p) => p.status === "upcoming" || p.status === "due")
            ? "pending"
            : "absent";

    return {
      date: iso,
      ...dayLabels(iso),
      status,
      note: leaveType
        ? leaveLabel(leaveType)
        : status === "upcoming"
          ? "Coming up"
          : `${attended} of ${MOSQUE_PRAYERS.length} prayers`,
      leaveType,
      prayers,
      attended,
      due,
      lateMinutes,
    };
  });
}

function summarizePrayerDays(days: PrayerDay[]): MosqueWeekSummary {
  return {
    days,
    attended: days.reduce((total, day) => total + day.attended, 0),
    due: days.reduce((total, day) => total + day.due, 0),
    lateMinutes: days.reduce((total, day) => total + day.lateMinutes, 0),
    latePrayers: days.reduce((total, day) => total + day.prayers.filter((p) => p.status === "late").length, 0),
  };
}

/** This week, Sunday to Saturday, prayer by prayer. */
export function buildMosqueWeek(args: MosqueDaySources): MosqueWeekSummary {
  return summarizePrayerDays(
    buildPrayerDays(args, weekStartIso(maldivesTodayIso(args.today)), MOSQUE_WEEK_DAYS),
  );
}

/** The previous week, Sunday to Saturday. */
export function buildMosqueLastWeek(args: MosqueDaySources): MosqueWeekSummary {
  return summarizePrayerDays(
    buildPrayerDays(args, lastWeekStartIso(maldivesTodayIso(args.today)), MOSQUE_WEEK_DAYS),
  );
}

/** Every date the mosque profile shows: last week and this week. */
export function mosqueProfileDates(todayIso: string): string[] {
  const start = lastWeekStartIso(todayIso);
  return Array.from({ length: MOSQUE_WEEK_DAYS * 2 }, (_, index) => addDaysIso(start, index));
}

export function isMosqueEmployee(employee: { section?: unknown }): boolean {
  return typeof employee.section === "string" && employee.section.trim().toLowerCase() === "mosque";
}

/** A prayer not signed in counts as this many minutes absent, as in the mosque reports. */
export const ABSENT_PRAYER_MINUTES = 60;

export type MosqueMonthTotals = {
  absentMinutes: number;
  missedPrayers: number;
  lateMinutes: number;
  latePrayers: number;
  /** Days with at least one late prayer. */
  lateDays: number;
};

/**
 * Absent and late time for the current month up to now. Like the mosque
 * reports, only days with an attendance sheet count and leave days are left out.
 */
export function buildMosqueMonthTotals(args: MosqueDaySources): MosqueMonthTotals {
  const todayIso = maldivesTodayIso(args.today);
  const recorded = new Set(args.mosqueAttendance.map((row) => row.date));
  const days = buildPrayerDays(args, `${todayIso.slice(0, 7)}-01`, Number(todayIso.slice(8, 10)))
    .filter((day) => recorded.has(day.date));
  const slots = days.flatMap((day) => day.prayers);
  const missedPrayers = slots.filter((slot) => slot.status === "missed").length;
  return {
    absentMinutes: missedPrayers * ABSENT_PRAYER_MINUTES,
    missedPrayers,
    lateMinutes: slots.reduce((total, slot) => total + slot.lateMinutes, 0),
    latePrayers: slots.filter((slot) => slot.status === "late").length,
    lateDays: days.filter((day) => day.prayers.some((slot) => slot.status === "late")).length,
  };
}
