"use client";

import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";
import { CouncilDatePicker } from "@/components/design-system/council-date-picker";
import { EmptyState } from "@/components/design-system/empty-state";
import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { Button } from "@/components/ui/button";
import {
  useEmployeesQuery,
  useMosqueAssistantsQuery,
  useMosqueAttendancePeriodQuery,
} from "@/hooks/queries";
import {
  fetchAllEmployees,
  fetchMosqueAssistants,
  fetchMosqueAttendanceForPeriod,
} from "@/lib/actions/hr.actions";
import { reverseLeaveTypeMapping } from "@/constants";
import type { EmployeeDoc } from "@/lib/firebase/types";
import { isOnAttendanceLeave } from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import {
  AlarmClock,
  CalendarOff,
  CalendarRange,
  CalendarSearch,
  Clock3,
  Download,
  FileBarChart2,
  Palmtree,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import styles from "./mosque-monthly-report.module.css";

type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      designation?: string;
      joinedDate?: string;
      section?: string;
    };

type MosqueAttendanceRecord = {
  date: string;
  employeeId: EmployeeRef;
  leaveType: string | null;
  fathisSignInTime: string | null;
  mendhuruSignInTime: string | null;
  asuruSignInTime: string | null;
  maqribSignInTime: string | null;
  ishaSignInTime: string | null;
  fathisMinutesLate: number;
  mendhuruMinutesLate: number;
  asuruMinutesLate: number;
  maqribMinutesLate: number;
  ishaMinutesLate: number;
};

type PrayerLateTotals = {
  fathisMinutesLate: number;
  mendhuruMinutesLate: number;
  asuruMinutesLate: number;
  maqribMinutesLate: number;
  ishaMinutesLate: number;
};

type ReportEntry = PrayerLateTotals & {
  id: string;
  name: string;
  designation: string;
  joinedDate: string;
  section: string;
  totalMinutesLate: number;
  lateCheckIns: number;
  lateDays: number;
};

type ReportAccumulator = ReportEntry & {
  lateDates: Set<string>;
};

type AllowancePrayerKey =
  | "fathis"
  | "dhuhr"
  | "hukuru"
  | "asr"
  | "maqrib"
  | "isha";

type AllowanceTotals = Record<AllowancePrayerKey, number>;

type AllowanceEntry = AllowanceTotals & {
  id: string;
  name: string;
  total: number;
  counts: AllowanceTotals;
};

type LateAbsentPrayerKey = "fathis" | "dhuhr" | "asr" | "maqrib" | "isha";

type LateAbsentTotals = Record<LateAbsentPrayerKey, number>;

type LateAbsentEntry = LateAbsentTotals & {
  id: string;
  name: string;
  total: number;
  absentCounts: LateAbsentTotals;
};

type ReportPeriod = {
  startDate: string;
  endDate: string;
};

type LeaveDetailEntry = {
  name: string;
  total: number;
  byType: Array<{ label: string; count: number }>;
};

const prayerColumns = [
  { key: "fathisMinutesLate", label: "Fajr" },
  { key: "mendhuruMinutesLate", label: "Dhuhr" },
  { key: "asuruMinutesLate", label: "Asr" },
  { key: "maqribMinutesLate", label: "Maghrib" },
  { key: "ishaMinutesLate", label: "Isha" },
] as const;

const ALLOWANCE_RATES = {
  fathis: 55,
  dhuhr: 25,
  hukuru: 55,
  asr: 25,
  maqrib: 25,
  isha: 25,
} as const;

/** Fixed display order for allowance / late-absent staff. */
const MOSQUE_REPORT_STAFF_ORDER = [
  "mohamed mahir",
  "ibrahim waseem",
  "ibrahim hashim",
  "hawwa luiza",
] as const;

const ABSENT_PRAYER_LATE_MINUTES = 60;

/** Imams listed in the Leave details section, in display order. */
const LEAVE_DETAIL_STAFF = ["Ahmed Zahidh", "Mohamed Shahidh"] as const;

const allowanceColumns = [
  { key: "fathis", label: "Fathis" },
  { key: "dhuhr", label: "Dhuhr" },
  { key: "hukuru", label: "Hukuru" },
  { key: "asr", label: "Asr" },
  { key: "maqrib", label: "Maqrib" },
  { key: "isha", label: "Isha" },
] as const;

const lateAbsentColumns = [
  {
    key: "fathis",
    label: "Fathis",
    signInKey: "fathisSignInTime",
    lateKey: "fathisMinutesLate",
  },
  {
    key: "dhuhr",
    label: "Dhuhr",
    signInKey: "mendhuruSignInTime",
    lateKey: "mendhuruMinutesLate",
  },
  {
    key: "asr",
    label: "Asr",
    signInKey: "asuruSignInTime",
    lateKey: "asuruMinutesLate",
  },
  {
    key: "maqrib",
    label: "Maqrib",
    signInKey: "maqribSignInTime",
    lateKey: "maqribMinutesLate",
  },
  {
    key: "isha",
    label: "Isha",
    signInKey: "ishaSignInTime",
    lateKey: "ishaMinutesLate",
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function getNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function getEmployeeRef(
  record: Record<string, unknown>,
  key: string,
): EmployeeRef {
  const value = record[key];
  if (typeof value === "string") return value;

  if (isRecord(value)) {
    const employee = {
      $id: getString(value, "$id"),
      name: getString(value, "name"),
      designation: getString(value, "designation") || undefined,
      joinedDate: getString(value, "joinedDate") || undefined,
      section: getString(value, "section") || undefined,
    };

    if (
      employee.$id ||
      employee.name ||
      employee.designation ||
      employee.joinedDate ||
      employee.section
    ) {
      return employee;
    }
  }

  return "";
}

function normalizeAttendance(raw: unknown): MosqueAttendanceRecord[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      date: getString(record, "date"),
      employeeId: getEmployeeRef(record, "employeeId"),
      leaveType: getNullableString(record, "leaveType"),
      fathisSignInTime: getNullableString(record, "fathisSignInTime"),
      mendhuruSignInTime: getNullableString(record, "mendhuruSignInTime"),
      asuruSignInTime: getNullableString(record, "asuruSignInTime"),
      maqribSignInTime: getNullableString(record, "maqribSignInTime"),
      ishaSignInTime: getNullableString(record, "ishaSignInTime"),
      fathisMinutesLate: getNumber(record, "fathisMinutesLate"),
      mendhuruMinutesLate: getNumber(record, "mendhuruMinutesLate"),
      asuruMinutesLate: getNumber(record, "asuruMinutesLate"),
      maqribMinutesLate: getNumber(record, "maqribMinutesLate"),
      ishaMinutesLate: getNumber(record, "ishaMinutesLate"),
    };
  });
}

function isFriday(date: string): boolean {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay() === 5;
}

function hasCheckIn(value: string | null): boolean {
  return Boolean(value);
}

function mosqueReportStaffRank(name: string): number {
  const normalized = name.trim().toLowerCase();
  return MOSQUE_REPORT_STAFF_ORDER.findIndex((entry) => entry === normalized);
}

function isMosqueReportStaff(name: string): boolean {
  return mosqueReportStaffRank(name) >= 0;
}

function compareMosqueReportStaff(aName: string, bName: string): number {
  const aRank = mosqueReportStaffRank(aName);
  const bRank = mosqueReportStaffRank(bName);
  if (aRank !== bRank) return aRank - bRank;
  return aName.localeCompare(bName);
}

function formatAllowance(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

function emptyAllowanceTotals(): AllowanceTotals {
  return {
    fathis: 0,
    dhuhr: 0,
    hukuru: 0,
    asr: 0,
    maqrib: 0,
    isha: 0,
  };
}

function emptyLateAbsentTotals(): LateAbsentTotals {
  return {
    fathis: 0,
    dhuhr: 0,
    asr: 0,
    maqrib: 0,
    isha: 0,
  };
}

function addAllowance(
  entry: AllowanceEntry,
  prayer: AllowancePrayerKey,
): void {
  entry[prayer] += ALLOWANCE_RATES[prayer];
  entry.counts[prayer] += 1;
}

function prayerLateOrAbsentMinutes(
  signInTime: string | null,
  minutesLate: number,
): { minutes: number; absent: boolean } {
  if (hasCheckIn(signInTime)) {
    return { minutes: minutesLate, absent: false };
  }
  return { minutes: ABSENT_PRAYER_LATE_MINUTES, absent: true };
}

function getMaldivesMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Indian/Maldives",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

function getDefaultReportPeriod(): ReportPeriod {
  const month = getMaldivesMonth();
  const [year, monthNumber] = month.split("-").map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  const safeMonth = Number.isFinite(monthNumber) ? monthNumber : 1;
  const previousMonth = new Date(Date.UTC(safeYear, safeMonth - 2, 1));
  const startDate = `${previousMonth.getUTCFullYear()}-${String(
    previousMonth.getUTCMonth() + 1,
  ).padStart(2, "0")}-11`;
  const endDate = `${safeYear}-${String(safeMonth).padStart(2, "0")}-10`;
  return { startDate, endDate };
}

/** Fixed cycle: previous month 16th through ending month 15th. */
function getAllowancePeriod(month = getMaldivesMonth()): ReportPeriod {
  const [year, monthNumber] = month.split("-").map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  const safeMonth = Number.isFinite(monthNumber) ? monthNumber : 1;
  const previousMonth = new Date(Date.UTC(safeYear, safeMonth - 2, 1));
  const startDate = `${previousMonth.getUTCFullYear()}-${String(
    previousMonth.getUTCMonth() + 1,
  ).padStart(2, "0")}-16`;
  const endDate = `${safeYear}-${String(safeMonth).padStart(2, "0")}-15`;
  return { startDate, endDate };
}

function formatPeriod(period: ReportPeriod): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${period.startDate}T00:00:00Z`))} – ${formatter.format(
    new Date(`${period.endDate}T00:00:00Z`),
  )}`;
}

function isValidPeriod(period: ReportPeriod): boolean {
  return Boolean(
    period.startDate &&
      period.endDate &&
      period.startDate <= period.endDate,
  );
}

function formatDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  return `${new Intl.NumberFormat("en-US").format(safeMinutes)} min`;
}

function buildEmployeeInfoMap(
  assistants: EmployeeDoc[],
  allEmployees: EmployeeDoc[],
): Map<string, { name: string; designation: string }> {
  const employeesById = new Map<
    string,
    { name: string; designation: string }
  >();

  for (const employee of [...assistants, ...allEmployees]) {
    if (!employeesById.has(employee.$id)) {
      employeesById.set(employee.$id, {
        name: employee.name,
        designation:
          typeof employee.designation === "string" ? employee.designation : "",
      });
    }
  }

  return employeesById;
}

function buildMosqueReport(
  period: ReportPeriod,
  raw: unknown,
  employeesById: Map<string, { name: string; designation: string }>,
): ReportEntry[] {
  const attendanceRecords = normalizeAttendance(raw).filter((record) => {
    const date = record.date.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  const reportByEmployee = new Map<string, ReportAccumulator>();

  for (const attendance of attendanceRecords) {
    let id = "";
    let name = "Unknown employee";
    let designation = "";
    let joinedDate = "";
    let section = "";

    if (typeof attendance.employeeId === "string") {
      id = attendance.employeeId;
      const employee = employeesById.get(attendance.employeeId);
      name = employee?.name || "Unknown employee";
      designation = employee?.designation || "";
    } else {
      id = attendance.employeeId.$id || attendance.employeeId.name;
      name = attendance.employeeId.name || attendance.employeeId.$id || name;
      designation = attendance.employeeId.designation || "";
      joinedDate = attendance.employeeId.joinedDate || "";
      section = attendance.employeeId.section || "";
    }

    if (!id) continue;

    const current = reportByEmployee.get(id) ?? {
      id,
      name,
      designation,
      joinedDate,
      section,
      fathisMinutesLate: 0,
      mendhuruMinutesLate: 0,
      asuruMinutesLate: 0,
      maqribMinutesLate: 0,
      ishaMinutesLate: 0,
      totalMinutesLate: 0,
      lateCheckIns: 0,
      lateDays: 0,
      lateDates: new Set<string>(),
    };

    let wasLateOnDate = false;
    for (const prayer of prayerColumns) {
      const minutes = attendance[prayer.key];
      current[prayer.key] += minutes;
      current.totalMinutesLate += minutes;
      if (minutes > 0) {
        current.lateCheckIns += 1;
        wasLateOnDate = true;
      }
    }

    if (wasLateOnDate) {
      current.lateDates.add(attendance.date.slice(0, 10));
      current.lateDays = current.lateDates.size;
    }

    reportByEmployee.set(id, current);
  }

  return Array.from(reportByEmployee.values())
    .map((employee) => {
      const { lateDates, ...entry } = employee;
      return { ...entry, lateDays: lateDates.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveEmployeeIdentity(
  attendance: MosqueAttendanceRecord,
  employeesById: Map<string, { name: string; designation: string }>,
): { id: string; name: string } | null {
  if (typeof attendance.employeeId === "string") {
    if (!attendance.employeeId) return null;
    return {
      id: attendance.employeeId,
      name: employeesById.get(attendance.employeeId)?.name || "Unknown employee",
    };
  }

  const id = attendance.employeeId.$id || attendance.employeeId.name;
  if (!id) return null;
  return {
    id,
    name: attendance.employeeId.name || attendance.employeeId.$id || "Unknown employee",
  };
}

function buildAllowanceReport(
  period: ReportPeriod,
  raw: unknown,
  employeesById: Map<string, { name: string; designation: string }>,
): AllowanceEntry[] {
  const attendanceRecords = normalizeAttendance(raw).filter((record) => {
    const date = record.date.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  const reportByEmployee = new Map<string, AllowanceEntry>();

  for (const attendance of attendanceRecords) {
    const identity = resolveEmployeeIdentity(attendance, employeesById);
    if (!identity) continue;
    if (!isMosqueReportStaff(identity.name)) continue;
    // Leave days never earn allowance, even if a check-in exists.
    if (isOnAttendanceLeave(attendance.leaveType)) continue;

    const current = reportByEmployee.get(identity.id) ?? {
      id: identity.id,
      name: identity.name,
      ...emptyAllowanceTotals(),
      total: 0,
      counts: emptyAllowanceTotals(),
    };

    if (hasCheckIn(attendance.fathisSignInTime)) {
      addAllowance(current, "fathis");
    }

    if (hasCheckIn(attendance.mendhuruSignInTime)) {
      addAllowance(current, isFriday(attendance.date) ? "hukuru" : "dhuhr");
    }

    if (hasCheckIn(attendance.asuruSignInTime)) {
      addAllowance(current, "asr");
    }
    if (hasCheckIn(attendance.maqribSignInTime)) {
      addAllowance(current, "maqrib");
    }
    if (hasCheckIn(attendance.ishaSignInTime)) {
      addAllowance(current, "isha");
    }

    current.total =
      current.fathis +
      current.dhuhr +
      current.hukuru +
      current.asr +
      current.maqrib +
      current.isha;

    reportByEmployee.set(identity.id, current);
  }

  return Array.from(reportByEmployee.values()).sort((a, b) =>
    compareMosqueReportStaff(a.name, b.name),
  );
}

function buildLateAbsentReport(
  period: ReportPeriod,
  raw: unknown,
  employeesById: Map<string, { name: string; designation: string }>,
): LateAbsentEntry[] {
  const attendanceRecords = normalizeAttendance(raw).filter((record) => {
    const date = record.date.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  const reportByEmployee = new Map<string, LateAbsentEntry>();

  for (const attendance of attendanceRecords) {
    const identity = resolveEmployeeIdentity(attendance, employeesById);
    if (!identity) continue;
    if (!isMosqueReportStaff(identity.name)) continue;
    // Leave days are neither late nor absent for this calculation.
    if (isOnAttendanceLeave(attendance.leaveType)) continue;

    const current = reportByEmployee.get(identity.id) ?? {
      id: identity.id,
      name: identity.name,
      ...emptyLateAbsentTotals(),
      total: 0,
      absentCounts: emptyLateAbsentTotals(),
    };

    for (const prayer of lateAbsentColumns) {
      const result = prayerLateOrAbsentMinutes(
        attendance[prayer.signInKey],
        attendance[prayer.lateKey],
      );
      current[prayer.key] += result.minutes;
      if (result.absent) {
        current.absentCounts[prayer.key] += 1;
      }
    }

    current.total =
      current.fathis +
      current.dhuhr +
      current.asr +
      current.maqrib +
      current.isha;

    reportByEmployee.set(identity.id, current);
  }

  return Array.from(reportByEmployee.values()).sort((a, b) =>
    compareMosqueReportStaff(a.name, b.name),
  );
}

/** Leave count per listed imam (one per date), broken down by leave type. */
function buildLeaveDetails(
  period: ReportPeriod,
  raw: unknown,
  employeesById: Map<string, { name: string; designation: string }>,
): LeaveDetailEntry[] {
  const leaveByStaff = new Map<string, Map<string, string>>(
    LEAVE_DETAIL_STAFF.map((name) => [name.toLowerCase(), new Map()]),
  );

  for (const attendance of normalizeAttendance(raw)) {
    const date = attendance.date.slice(0, 10);
    if (date < period.startDate || date > period.endDate) continue;
    if (!isOnAttendanceLeave(attendance.leaveType)) continue;
    const identity = resolveEmployeeIdentity(attendance, employeesById);
    const dates = identity && leaveByStaff.get(identity.name.trim().toLowerCase());
    if (!dates) continue;
    const type = attendance.leaveType!.trim();
    dates.set(date, reverseLeaveTypeMapping[type] ?? type);
  }

  return LEAVE_DETAIL_STAFF.map((name) => {
    const labels = Array.from(leaveByStaff.get(name.toLowerCase())?.values() ?? []);
    const counts = new Map<string, number>();
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    return {
      name,
      total: labels.length,
      byType: Array.from(counts, ([label, count]) => ({ label, count })).sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label),
      ),
    };
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

type Tone = "present" | "late" | "missed" | "annual" | "leave";

/** Glossy icon tile in the employee-portal style, including a rose "missed" tone. */
function GlossTile({
  tone,
  icon: Icon,
  className,
}: {
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <span
      className={cn(motifs.glossIcon, tone === "missed" && styles.missedTone, className)}
      data-tone={tone}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  aside,
  detail,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  unit?: string;
  aside?: string;
  detail?: string;
  tone: Tone;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <GlossTile tone={tone} icon={icon} className={styles.statIcon} />
      <div className={styles.statBody}>
        <p className={styles.label}>{label}</p>
        {value !== undefined ? (
          <p className={styles.statValue}>
            {value}
            {unit ? <small>{unit}</small> : null}
            {aside ? <span className={styles.statAside}>{aside}</span> : null}
          </p>
        ) : null}
        {children}
        {detail ? <p className={styles.statDetail}>{detail}</p> : null}
      </div>
    </div>
  );
}

function SectionHead({
  icon,
  tone,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitle}>
        <GlossTile tone={tone} icon={icon} className={styles.sectionIcon} />
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function PersonCell({ name, detail, index }: { name: string; detail?: string; index: number }) {
  return (
    <div className={styles.person}>
      <span className={styles.avatar} data-tint={index % 4}>
        {initials(name)}
      </span>
      <span className={styles.personText}>
        <strong>{name}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
    </div>
  );
}

function MinutesChip({
  value,
  tone = "late",
  absences = 0,
}: {
  value: number;
  tone?: Tone;
  /** Prayers not signed in, shown inside the same pill after the minutes. */
  absences?: number;
}) {
  if (value <= 0) return <span className={styles.chip} data-tone="zero">0</span>;
  return (
    <span className={styles.chip} data-tone={tone}>
      {new Intl.NumberFormat("en-US").format(value)}
      <small>min</small>
      {absences > 0 ? <span className={styles.absent}>{absences} absent</span> : null}
    </span>
  );
}

/** 1531 → "25 h 31 min"; whole hours drop the minutes. */
function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function shiftMonthKey(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The 11th of the previous month through the 10th of `month`. */
function reportCycle(month: string): ReportPeriod {
  return { startDate: `${shiftMonthKey(month, -1)}-11`, endDate: `${month}-10` };
}

function calendarMonth(month: string): ReportPeriod {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function periodDays(period: ReportPeriod): number {
  return (
    Math.round(
      (Date.parse(`${period.endDate}T00:00:00Z`) - Date.parse(`${period.startDate}T00:00:00Z`)) / 86_400_000,
    ) + 1
  );
}

function datePart(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Tear-off calendar page for one date: month band, big day, weekday. */
function CalendarPage({ iso, tone }: { iso: string; tone: Tone }) {
  return (
    <div className={cn(motifs.calendarPage, styles.heroPage)} data-tone={tone}>
      <span className={motifs.calendarPageTop}>{datePart(iso, { month: "short", year: "2-digit" })}</span>
      <strong>{datePart(iso, { day: "numeric" })}</strong>
      <small>{datePart(iso, { weekday: "short" })}</small>
    </div>
  );
}

export function MosqueMonthlyReportsView({
  initialAssistants,
  initialEmployees,
  initialAttendance,
  initialAllowanceAttendance,
}: {
  initialAssistants?: Awaited<ReturnType<typeof fetchMosqueAssistants>>;
  initialEmployees?: Awaited<ReturnType<typeof fetchAllEmployees>>;
  initialAttendance?: Awaited<ReturnType<typeof fetchMosqueAttendanceForPeriod>>;
  initialAllowanceAttendance?: Awaited<
    ReturnType<typeof fetchMosqueAttendanceForPeriod>
  >;
}) {
  const defaultPeriod = useMemo(getDefaultReportPeriod, []);
  const allowancePeriod = useMemo(() => getAllowancePeriod(), []);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>(defaultPeriod);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(defaultPeriod);

  const selectedPeriodValid = isValidPeriod(selectedPeriod);

  const { data: assistants = [] } = useMosqueAssistantsQuery({
    initialData: initialAssistants,
  });
  const { data: allEmployees = [] } = useEmployeesQuery({
    initialData: initialEmployees,
  });
  const {
    data: rawAttendance,
    isLoading,
    isFetching,
    isError,
    isSuccess,
    refetch,
  } = useMosqueAttendancePeriodQuery(
    reportPeriod.startDate,
    reportPeriod.endDate,
    { initialData: initialAttendance },
  );
  const {
    data: rawAllowanceAttendance,
    isLoading: allowanceLoading,
    isFetching: allowanceFetching,
    isError: allowanceError,
    isSuccess: allowanceSuccess,
    refetch: refetchAllowance,
  } = useMosqueAttendancePeriodQuery(
    allowancePeriod.startDate,
    allowancePeriod.endDate,
    { initialData: initialAllowanceAttendance },
  );

  const employeesById = useMemo(
    () => buildEmployeeInfoMap(assistants, allEmployees),
    [assistants, allEmployees],
  );

  // The period sections cover the two imams only, in the same order as Leave details.
  const reportData = useMemo(() => {
    const rank = (name: string) =>
      LEAVE_DETAIL_STAFF.findIndex((staff) => staff.toLowerCase() === name.trim().toLowerCase());
    return buildMosqueReport(reportPeriod, rawAttendance, employeesById)
      .filter((employee) => rank(employee.name) >= 0)
      .sort((a, b) => rank(a.name) - rank(b.name));
  }, [reportPeriod, rawAttendance, employeesById]);

  const leaveDetails = useMemo(
    () => buildLeaveDetails(reportPeriod, rawAttendance, employeesById),
    [reportPeriod, rawAttendance, employeesById],
  );

  const allowanceData = useMemo(
    () =>
      buildAllowanceReport(
        allowancePeriod,
        rawAllowanceAttendance,
        employeesById,
      ),
    [allowancePeriod, rawAllowanceAttendance, employeesById],
  );

  const allowanceSummary = useMemo(() => {
    const prayerTotals = allowanceColumns.map((column) => ({
      key: column.key,
      label: column.label,
      amount: allowanceData.reduce(
        (sum, employee) => sum + employee[column.key],
        0,
      ),
      count: allowanceData.reduce(
        (sum, employee) => sum + employee.counts[column.key],
        0,
      ),
    }));

    return {
      prayerTotals,
      total: allowanceData.reduce((sum, employee) => sum + employee.total, 0),
    };
  }, [allowanceData]);

  const lateAbsentData = useMemo(
    () =>
      buildLateAbsentReport(
        allowancePeriod,
        rawAllowanceAttendance,
        employeesById,
      ),
    [allowancePeriod, rawAllowanceAttendance, employeesById],
  );

  const lateAbsentSummary = useMemo(() => {
    const prayerTotals = lateAbsentColumns.map((column) => ({
      key: column.key,
      label: column.label,
      minutes: lateAbsentData.reduce(
        (sum, employee) => sum + employee[column.key],
        0,
      ),
      absentCount: lateAbsentData.reduce(
        (sum, employee) => sum + employee.absentCounts[column.key],
        0,
      ),
    }));

    return {
      prayerTotals,
      total: lateAbsentData.reduce((sum, employee) => sum + employee.total, 0),
    };
  }, [lateAbsentData]);

  const summary = useMemo(() => {
    const prayerTotals = prayerColumns.map((prayer) => ({
      label: prayer.label,
      minutes: reportData.reduce(
        (sum, employee) => sum + employee[prayer.key],
        0,
      ),
    }));
    const highestPrayer = prayerTotals.reduce(
      (highest, prayer) =>
        prayer.minutes > highest.minutes ? prayer : highest,
      prayerTotals[0] ?? { label: "None", minutes: 0 },
    );

    return {
      totalMinutes: reportData.reduce(
        (sum, employee) => sum + employee.totalMinutesLate,
        0,
      ),
      lateCheckIns: reportData.reduce(
        (sum, employee) => sum + employee.lateCheckIns,
        0,
      ),
      lateDays: reportData.reduce(
        (sum, employee) => sum + employee.lateDays,
        0,
      ),
      highestPrayer,
      prayerTotals,
    };
  }, [reportData]);

  const loading = isLoading || isFetching;
  const allowanceBusy = allowanceLoading || allowanceFetching;
  const reportAvailable = isSuccess && !isError && reportData.length > 0;
  const allowanceAvailable =
    allowanceSuccess && !allowanceError && allowanceData.length > 0;
  const lateAbsentAvailable =
    allowanceSuccess && !allowanceError && lateAbsentData.length > 0;

  const handleGenerateReport = () => {
    if (!selectedPeriodValid) return;

    if (
      reportPeriod.startDate === selectedPeriod.startDate &&
      reportPeriod.endDate === selectedPeriod.endDate
    ) {
      void refetch();
      return;
    }
    setReportPeriod(selectedPeriod);
  };

  const downloadCsvFile = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!reportAvailable) return;

    downloadCsvFile(
      `Mosque_Attendance_${reportPeriod.startDate}_to_${reportPeriod.endDate}.csv`,
      [
        "Period Start",
        "Period End",
        "Employee Name",
        "Designation",
        "Fajr Late (mins)",
        "Dhuhr Late (mins)",
        "Asr Late (mins)",
        "Maghrib Late (mins)",
        "Isha Late (mins)",
        "Total Days Late",
        "Late Check-ins",
        "Total Late (mins)",
        "Total Late (formatted)",
      ],
      reportData.map((employee) => [
        reportPeriod.startDate,
        reportPeriod.endDate,
        employee.name,
        employee.designation,
        employee.fathisMinutesLate,
        employee.mendhuruMinutesLate,
        employee.asuruMinutesLate,
        employee.maqribMinutesLate,
        employee.ishaMinutesLate,
        employee.lateDays,
        employee.lateCheckIns,
        employee.totalMinutesLate,
        formatDuration(employee.totalMinutesLate),
      ]),
    );
  };

  const downloadAllowanceCSV = () => {
    if (!allowanceAvailable) return;

    downloadCsvFile(
      `Mosque_Attendance_Allowance_${allowancePeriod.startDate}_to_${allowancePeriod.endDate}.csv`,
      [
        "Period Start",
        "Period End",
        "Name",
        "Fathis",
        "Fathis Count",
        "Dhuhr",
        "Dhuhr Count",
        "Hukuru",
        "Hukuru Count",
        "Asr",
        "Asr Count",
        "Maqrib",
        "Maqrib Count",
        "Isha",
        "Isha Count",
        "Total",
      ],
      allowanceData.map((employee) => [
        allowancePeriod.startDate,
        allowancePeriod.endDate,
        employee.name,
        employee.fathis,
        employee.counts.fathis,
        employee.dhuhr,
        employee.counts.dhuhr,
        employee.hukuru,
        employee.counts.hukuru,
        employee.asr,
        employee.counts.asr,
        employee.maqrib,
        employee.counts.maqrib,
        employee.isha,
        employee.counts.isha,
        employee.total,
      ]),
    );
  };

  const downloadLateAbsentCSV = () => {
    if (!lateAbsentAvailable) return;

    downloadCsvFile(
      `Mosque_Late_Absent_${allowancePeriod.startDate}_to_${allowancePeriod.endDate}.csv`,
      [
        "Period Start",
        "Period End",
        "Name",
        "Fathis (mins)",
        "Fathis Absences",
        "Dhuhr (mins)",
        "Dhuhr Absences",
        "Asr (mins)",
        "Asr Absences",
        "Maqrib (mins)",
        "Maqrib Absences",
        "Isha (mins)",
        "Isha Absences",
        "Total (mins)",
      ],
      lateAbsentData.map((employee) => [
        allowancePeriod.startDate,
        allowancePeriod.endDate,
        employee.name,
        employee.fathis,
        employee.absentCounts.fathis,
        employee.dhuhr,
        employee.absentCounts.dhuhr,
        employee.asr,
        employee.absentCounts.asr,
        employee.maqrib,
        employee.absentCounts.maqrib,
        employee.isha,
        employee.absentCounts.isha,
        employee.total,
      ]),
    );
  };

  const presets = (() => {
    const month = getMaldivesMonth();
    return [
      { key: "cycle", label: "This cycle", ...reportCycle(month) },
      { key: "last-cycle", label: "Last cycle", ...reportCycle(shiftMonthKey(month, -1)) },
      { key: "month", label: "This month", ...calendarMonth(month) },
      { key: "last-month", label: "Last month", ...calendarMonth(shiftMonthKey(month, -1)) },
    ];
  })();

  // A preset sets the dates and runs the report straight away.
  const applyPreset = (period: ReportPeriod) => {
    setSelectedPeriod(period);
    if (period.startDate === reportPeriod.startDate && period.endDate === reportPeriod.endDate) {
      void refetch();
      return;
    }
    setReportPeriod(period);
  };

  const topPrayerMinutes = summary.highestPrayer.minutes;

  return (
    <PageShell maxWidth="full">
      <div className={cn("mx-auto max-w-[1500px]", styles.page)}>
        <PageHeader
          icon={FileBarChart2}
          title="Mosque Attendance Report"
          subtitle="Late arrivals, leave and the attendance allowance for mosque staff"
          className="mb-8"
        />

        <section className={styles.hero} aria-label="Reporting period">
          <div className={styles.heroPeriod}>
            <div className={styles.heroPages}>
              <CalendarPage iso={reportPeriod.startDate} tone="annual" />
              <span className={styles.heroArrow}>
                <b>→</b>
                {periodDays(reportPeriod)} days
              </span>
              <CalendarPage iso={reportPeriod.endDate} tone="present" />
            </div>
            <div>
              <p className={styles.label}>Reporting period</p>
              <p className={styles.heroTitle}>{formatPeriod(reportPeriod)}</p>
              <p className={styles.heroSub}>
                Pick a preset or any two dates. The allowance below always uses its own fixed cycle.
              </p>
            </div>
          </div>

          <div className={styles.heroControls}>
            <div className={styles.presets}>
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={styles.preset}
                  data-active={
                    preset.startDate === reportPeriod.startDate && preset.endDate === reportPeriod.endDate
                  }
                  onClick={() => applyPreset({ startDate: preset.startDate, endDate: preset.endDate })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.dates}>
              <label className={styles.dateField} htmlFor="report-start-date">
                <span>From</span>
                <CouncilDatePicker
                  id="report-start-date"
                  value={selectedPeriod.startDate}
                  onChange={(startDate) =>
                    setSelectedPeriod((current) => ({ ...current, startDate }))
                  }
                  placeholder="Start date"
                />
              </label>
              <label className={styles.dateField} htmlFor="report-end-date">
                <span>To</span>
                <CouncilDatePicker
                  id="report-end-date"
                  value={selectedPeriod.endDate}
                  onChange={(endDate) =>
                    setSelectedPeriod((current) => ({ ...current, endDate }))
                  }
                  placeholder="End date"
                />
              </label>
              <Button
                type="button"
                variant="council"
                className="col-span-2 h-11 rounded-full px-5 sm:col-span-1"
                onClick={handleGenerateReport}
                disabled={loading || !selectedPeriodValid}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                {loading ? "Generating" : "Generate"}
              </Button>
            </div>
            <p className={styles.hint} data-error={!selectedPeriodValid}>
              {selectedPeriodValid
                ? `Selected: ${formatPeriod(selectedPeriod)}`
                : "End date must be on or after the start date."}
            </p>
          </div>
        </section>

        <div className={styles.stats}>
          <StatCard
            icon={Users}
            label="Employees"
            value={String(reportData.length)}
            detail="Staff with attendance sheets"
            tone="annual"
          />
          <StatCard
            icon={Clock3}
            label="Total late time"
            value={new Intl.NumberFormat("en-US").format(summary.totalMinutes)}
            unit="min"
            aside={summary.totalMinutes >= 60 ? formatHoursMinutes(summary.totalMinutes) : undefined}
            detail={`${summary.lateCheckIns} late check-in${summary.lateCheckIns === 1 ? "" : "s"} across all five prayers`}
            tone="late"
          />
          <StatCard
            icon={AlarmClock}
            label="Late employee-days"
            value={String(summary.lateDays)}
            detail="Days with at least one late prayer"
            tone="missed"
          />
        </div>

        <section className={styles.section}>
          <SectionHead
            icon={CalendarRange}
            tone="leave"
            title="Late minutes by prayer"
            subtitle={`All staff combined · ${formatPeriod(reportPeriod)}`}
          />
          <div className={styles.sectionBody}>
            <div className={styles.prayerGrid}>
              {summary.prayerTotals.map((prayer) => {
                const top = topPrayerMinutes > 0 && prayer.minutes === topPrayerMinutes;
                const share = summary.totalMinutes > 0
                  ? Math.round((prayer.minutes / summary.totalMinutes) * 100)
                  : 0;
                return (
                  <div key={prayer.label} className={styles.prayerCard} data-top={top}>
                    <div className={styles.prayerCardHead}>
                      <p>{prayer.label}</p>
                      {top ? <span className={styles.prayerTop}>Most late</span> : null}
                    </div>
                    <p className={styles.prayerMinutes}>
                      {new Intl.NumberFormat("en-US").format(prayer.minutes)}
                      <small>min</small>
                    </p>
                    <p className={styles.prayerHours}>
                      {prayer.minutes >= 60 ? formatHoursMinutes(prayer.minutes) : "Under an hour"}
                    </p>
                    <div className={styles.barTrack}>
                      <span
                        style={{
                          width: `${topPrayerMinutes > 0 ? (prayer.minutes / topPrayerMinutes) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className={styles.prayerShare}>{share}% of all late time</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionHead
            icon={Clock3}
            tone="late"
            title="Late-time breakdown"
            subtitle={`Minutes late by prayer · ${formatPeriod(reportPeriod)}`}
            action={
              <Button
                type="button"
                variant="council-outline"
                className="h-10 rounded-full"
                onClick={downloadCSV}
                disabled={!reportAvailable || loading}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            }
          />
          <div className={styles.sectionBody}>
            {loading ? (
              <SkeletonReportsTable />
            ) : isError ? (
              <EmptyState
                icon={CalendarSearch}
                title="The report could not be loaded"
                description="Check the connection and generate the report again."
                action={
                  <Button variant="council" onClick={() => void refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : !reportAvailable ? (
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(reportPeriod)}.`}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Designation</th>
                      {prayerColumns.map((prayer) => (
                        <th key={prayer.key}>{prayer.label}</th>
                      ))}
                      <th>Late days</th>
                      <th>Total late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((employee, index) => (
                      <tr key={employee.id}>
                        <td>
                          <PersonCell
                            name={employee.name}
                            index={index}
                            detail={`${employee.lateCheckIns} late prayer${employee.lateCheckIns === 1 ? "" : "s"}`}
                          />
                        </td>
                        <td>
                          <span className={styles.role}>{employee.designation || "Not specified"}</span>
                        </td>
                        {prayerColumns.map((prayer) => (
                          <td key={prayer.key}>
                            <MinutesChip value={employee[prayer.key]} />
                          </td>
                        ))}
                        <td>
                          <span className={styles.chip} data-tone={employee.lateDays > 0 ? "annual" : "zero"}>
                            {employee.lateDays}
                          </span>
                        </td>
                        <td>
                          <div className={styles.total}>
                            <strong data-tone={employee.totalMinutesLate > 0 ? "late" : "zero"}>
                              {formatDuration(employee.totalMinutesLate)}
                            </strong>
                            {employee.totalMinutesLate >= 60 ? (
                              <span>{formatHoursMinutes(employee.totalMinutesLate)}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Report total</td>
                      {summary.prayerTotals.map((prayer) => (
                        <td key={prayer.label}>
                          <span className={styles.footValue}>{prayer.minutes} min</span>
                        </td>
                      ))}
                      <td>
                        <span className={styles.footValue}>{summary.lateDays}</span>
                      </td>
                      <td>
                        <span className={styles.footTotal}>{formatDuration(summary.totalMinutes)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHead
            icon={Palmtree}
            tone="leave"
            title="Leave details"
            subtitle={`Leave taken by Zahidh and Shahidh · ${formatPeriod(reportPeriod)}`}
          />
          <div className={styles.sectionBody}>
            {loading ? (
              <SkeletonReportsTable />
            ) : isError ? (
              <p className={styles.leaveError}>Leave details could not be loaded.</p>
            ) : (
              <div className={styles.leaveGrid}>
                {leaveDetails.map((staff) => (
                  <div key={staff.name} className={styles.leaveCard} data-empty={staff.total === 0}>
                    <GlossTile
                      tone={staff.total > 0 ? "leave" : "present"}
                      icon={staff.total > 0 ? Palmtree : CalendarOff}
                      className={styles.leaveIcon}
                    />
                    <div className={styles.leaveBody}>
                      <div className={styles.leaveTop}>
                        <p>{staff.name}</p>
                        <span className={styles.leaveCount}>
                          {staff.total}
                          <small>day{staff.total === 1 ? "" : "s"}</small>
                        </span>
                      </div>
                      {staff.total === 0 ? (
                        <p className={styles.leaveNone}>No leave taken in this period.</p>
                      ) : (
                        <div className={styles.leaveTypes}>
                          {staff.byType.map((type) => (
                            <span key={type.label} className={styles.leaveType}>
                              {type.label}
                              <b>{type.count}</b>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className={styles.cycleBand}>
          <div className={styles.cycleTitle}>
            <h2>Allowance cycle</h2>
            <span className={styles.cyclePill}>
              <CalendarRange className="h-3.5 w-3.5" />
              {formatPeriod(allowancePeriod)}
            </span>
          </div>
          <p>The previous month&apos;s 16th through this month&apos;s 15th, whatever period is picked above.</p>
        </div>

        <section className={styles.section}>
          <SectionHead
            icon={Wallet}
            tone="present"
            title="Attendance allowance"
            subtitle="Amount per signed-in prayer, with the count in brackets. Friday Dhuhr counts as Hukuru; leave days earn nothing."
            action={
              <Button
                type="button"
                variant="council-outline"
                className="h-10 rounded-full"
                onClick={downloadAllowanceCSV}
                disabled={!allowanceAvailable || allowanceBusy}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            }
          />
          <div className={styles.sectionBody}>
            {allowanceBusy ? (
              <SkeletonReportsTable />
            ) : allowanceError ? (
              <EmptyState
                icon={CalendarSearch}
                title="The allowance report could not be loaded"
                description="Check the connection and try again."
                action={
                  <Button variant="council" onClick={() => void refetchAllowance()}>
                    Try again
                  </Button>
                }
              />
            ) : !allowanceAvailable ? (
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(allowancePeriod)}.`}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      {allowanceColumns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowanceData.map((employee, index) => (
                      <tr key={employee.id}>
                        <td>
                          <PersonCell name={employee.name} index={index} />
                        </td>
                        {allowanceColumns.map((column) => {
                          const amount = employee[column.key];
                          const count = employee.counts[column.key];
                          return (
                            <td key={column.key}>
                              {amount > 0 ? (
                                <span className={styles.chip} data-tone="present">
                                  {formatAllowance(amount)}
                                  <small>({count})</small>
                                </span>
                              ) : (
                                <span className={styles.chip} data-tone="zero">0</span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <div className={styles.total}>
                            <strong data-tone="present">{formatAllowance(employee.total)}</strong>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Report total</td>
                      {allowanceSummary.prayerTotals.map((column) => (
                        <td key={column.key}>
                          <span className={styles.footValue}>
                            {column.amount > 0 ? `${formatAllowance(column.amount)} (${column.count})` : "0"}
                          </span>
                        </td>
                      ))}
                      <td>
                        <span className={styles.footTotal}>{formatAllowance(allowanceSummary.total)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHead
            icon={AlarmClock}
            tone="missed"
            title="Late & absent calculation"
            subtitle={`Late minutes plus ${ABSENT_PRAYER_LATE_MINUTES} minutes for each prayer not signed in. Leave days are left out.`}
            action={
              <Button
                type="button"
                variant="council-outline"
                className="h-10 rounded-full"
                onClick={downloadLateAbsentCSV}
                disabled={!lateAbsentAvailable || allowanceBusy}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            }
          />
          <div className={styles.sectionBody}>
            {allowanceBusy ? (
              <SkeletonReportsTable />
            ) : allowanceError ? (
              <EmptyState
                icon={CalendarSearch}
                title="The late & absent report could not be loaded"
                description="Check the connection and try again."
                action={
                  <Button variant="council" onClick={() => void refetchAllowance()}>
                    Try again
                  </Button>
                }
              />
            ) : !lateAbsentAvailable ? (
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(allowancePeriod)}.`}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      {lateAbsentColumns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateAbsentData.map((employee, index) => (
                      <tr key={employee.id}>
                        <td>
                          <PersonCell name={employee.name} index={index} />
                        </td>
                        {lateAbsentColumns.map((column) => {
                          const minutes = employee[column.key];
                          const absences = employee.absentCounts[column.key];
                          return (
                            <td key={column.key}>
                              <MinutesChip
                                value={minutes}
                                tone={absences > 0 ? "missed" : "late"}
                                absences={absences}
                              />
                            </td>
                          );
                        })}
                        <td>
                          <div className={styles.total}>
                            <strong data-tone={employee.total > 0 ? "missed" : "zero"}>
                              {formatDuration(employee.total)}
                            </strong>
                            {employee.total >= 60 ? <span>{formatHoursMinutes(employee.total)}</span> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Report total</td>
                      {lateAbsentSummary.prayerTotals.map((column) => (
                        <td key={column.key}>
                          <span className={styles.footValue}>
                            {column.minutes > 0 ? `${column.minutes} min` : "0"}
                            {column.absentCount > 0 ? (
                              <span className={styles.absent}>{column.absentCount} absent</span>
                            ) : null}
                          </span>
                        </td>
                      ))}
                      <td>
                        <span className={styles.footTotal}>{formatDuration(lateAbsentSummary.total)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
