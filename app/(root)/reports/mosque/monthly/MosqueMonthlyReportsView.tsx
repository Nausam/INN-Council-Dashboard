"use client";

import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";
import { CouncilCard } from "@/components/design-system/council-card";
import { CouncilDatePicker } from "@/components/design-system/council-date-picker";
import { EmptyState } from "@/components/design-system/empty-state";
import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { EmployeeDoc } from "@/lib/firebase/types";
import { isOnAttendanceLeave } from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import {
  AlarmClock,
  CalendarRange,
  CalendarSearch,
  Clock3,
  Download,
  FileBarChart2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import React, { useMemo, useState } from "react";

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

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };

  return (
    <CouncilCard interactive="none" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CouncilCard>
  );
}

function LateMinutes({ value }: { value: number }) {
  if (value <= 0) {
    return <span className="font-medium text-slate-400">0</span>;
  }

  return (
    <span className="inline-flex min-w-14 items-center justify-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-100">
      +{value} min
    </span>
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

  const reportData = useMemo(
    () => buildMosqueReport(reportPeriod, rawAttendance, employeesById),
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

  return (
    <PageShell maxWidth="full">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          icon={FileBarChart2}
          title="Mosque Attendance Report"
          subtitle="Late-arrival summary for any selected date range"
          className="mb-8"
        />

        <CouncilCard
          interactive="none"
          className="mb-6 overflow-hidden border border-teal-100 p-0"
        >
          <div className="grid lg:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-4 bg-gradient-to-r from-teal-50 via-white to-white p-5 sm:p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-600/20">
                <CalendarRange className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                  Reporting period
                </p>
                <p className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                  {formatPeriod(reportPeriod)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose any start and end date, then generate the report.
                </p>
              </div>
            </div>

            <div className="flex min-w-[340px] flex-col justify-center border-t border-slate-100 bg-white p-5 lg:border-l lg:border-t-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="report-start-date"
                    className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    From
                  </label>
                  <CouncilDatePicker
                    id="report-start-date"
                    value={selectedPeriod.startDate}
                    onChange={(startDate) =>
                      setSelectedPeriod((current) => ({
                        ...current,
                        startDate,
                      }))
                    }
                    placeholder="Start date"
                  />
                </div>
                <div>
                  <label
                    htmlFor="report-end-date"
                    className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    To
                  </label>
                  <CouncilDatePicker
                    id="report-end-date"
                    value={selectedPeriod.endDate}
                    onChange={(endDate) =>
                      setSelectedPeriod((current) => ({
                        ...current,
                        endDate,
                      }))
                    }
                    placeholder="End date"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className={cn(
                    "text-xs",
                    selectedPeriodValid ? "text-slate-500" : "font-medium text-rose-600",
                  )}
                >
                  {selectedPeriodValid
                    ? `Selected: ${formatPeriod(selectedPeriod)}`
                    : "End date must be on or after the start date."}
                </p>
                <Button
                  type="button"
                  variant="council"
                  className="h-11 px-5"
                  onClick={handleGenerateReport}
                  disabled={loading || !selectedPeriodValid}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  {loading ? "Generating" : "Generate"}
                </Button>
              </div>
            </div>
          </div>
        </CouncilCard>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Employees"
            value={String(reportData.length)}
            detail="Staff with attendance sheets"
            tone="teal"
          />
          <StatCard
            icon={Clock3}
            label="Total late time"
            value={formatDuration(summary.totalMinutes)}
            detail="Combined across all five prayers"
            tone="rose"
          />
          <StatCard
            icon={AlarmClock}
            label="Late employee-days"
            value={String(summary.lateDays)}
            detail="Days with at least one late prayer"
            tone="amber"
          />
          <StatCard
            icon={CalendarRange}
            label="Most delayed prayer"
            value={summary.highestPrayer.minutes > 0 ? summary.highestPrayer.label : "None"}
            detail={
              summary.highestPrayer.minutes > 0
                ? `${summary.highestPrayer.minutes} minutes combined`
                : "No late minutes recorded"
            }
            tone="blue"
          />
        </div>

        <CouncilCard interactive="none" className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Employee late-time breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Minutes late by prayer for {formatPeriod(reportPeriod)}
              </p>
            </div>
            <Button
              type="button"
              variant="council-outline"
              className="h-10"
              onClick={downloadCSV}
              disabled={!reportAvailable || loading}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {loading ? (
            <div className="p-5 sm:p-6">
              <SkeletonReportsTable />
            </div>
          ) : isError ? (
            <div className="p-5 sm:p-6">
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
            </div>
          ) : !reportAvailable ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(reportPeriod)}.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-14 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    #
                  </TableHead>
                  <TableHead className="min-w-[230px] text-xs font-bold uppercase tracking-wider text-slate-500">
                    Employee
                  </TableHead>
                  <TableHead className="min-w-[150px] text-xs font-bold uppercase tracking-wider text-slate-500">
                    Designation
                  </TableHead>
                  {prayerColumns.map((prayer) => (
                    <TableHead
                      key={prayer.key}
                      className="min-w-[105px] text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {prayer.label}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[105px] text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    Late days
                  </TableHead>
                  <TableHead className="min-w-[130px] px-5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total late
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((employee, index) => (
                  <TableRow
                    key={employee.id}
                    className="border-slate-100 hover:bg-teal-50/30"
                  >
                    <TableCell className="px-5 font-medium text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                          {initials(employee.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {employee.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {employee.lateCheckIns} late prayer{employee.lateCheckIns === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {employee.designation || "Not specified"}
                      </span>
                    </TableCell>
                    {prayerColumns.map((prayer) => (
                      <TableCell key={prayer.key} className="text-center">
                        <LateMinutes value={employee[prayer.key]} />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-10 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold",
                          employee.lateDays > 0
                            ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"
                            : "text-slate-400",
                        )}
                      >
                        {employee.lateDays}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 text-right">
                      <span
                        className={cn(
                          "font-bold",
                          employee.totalMinutesLate > 0
                            ? "text-rose-700"
                            : "text-slate-500",
                        )}
                      >
                        {formatDuration(employee.totalMinutesLate)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableCell colSpan={3} className="px-5 font-bold text-slate-900">
                    Report total
                  </TableCell>
                  {summary.prayerTotals.map((prayer) => (
                    <TableCell
                      key={prayer.label}
                      className="text-center font-bold text-slate-700"
                    >
                      {prayer.minutes} min
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-amber-700">
                    {summary.lateDays}
                  </TableCell>
                  <TableCell className="px-5 text-right font-bold text-rose-700">
                    {formatDuration(summary.totalMinutes)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CouncilCard>

        <CouncilCard interactive="none" className="mt-6 overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Attendance Allowance
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatPeriod(allowancePeriod)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Fixed cycle from the previous month&apos;s 16th through this
                  month&apos;s 15th. Friday Dhuhr counts as Hukuru.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="council-outline"
              className="h-10"
              onClick={downloadAllowanceCSV}
              disabled={!allowanceAvailable || allowanceBusy}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {allowanceBusy ? (
            <div className="p-5 sm:p-6">
              <SkeletonReportsTable />
            </div>
          ) : allowanceError ? (
            <div className="p-5 sm:p-6">
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
            </div>
          ) : !allowanceAvailable ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(allowancePeriod)}.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="min-w-[230px] px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Name
                  </TableHead>
                  {allowanceColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className="min-w-[100px] text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[110px] px-5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowanceData.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="border-slate-100 hover:bg-teal-50/30"
                  >
                    <TableCell className="px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                          {initials(employee.name)}
                        </div>
                        <p className="font-semibold text-slate-900">
                          {employee.name}
                        </p>
                      </div>
                    </TableCell>
                    {allowanceColumns.map((column) => {
                      const amount = employee[column.key];
                      const count = employee.counts[column.key];
                      return (
                        <TableCell
                          key={column.key}
                          className="text-center font-semibold text-slate-700"
                        >
                          {amount > 0 ? (
                            <>
                              {formatAllowance(amount)}{" "}
                              <span className="font-medium text-slate-500">
                                ({count})
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-slate-400">0</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-5 text-right font-bold text-teal-700">
                      {formatAllowance(employee.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableCell className="px-5 font-bold text-slate-900">
                    Report total
                  </TableCell>
                  {allowanceSummary.prayerTotals.map((column) => (
                    <TableCell
                      key={column.key}
                      className="text-center font-bold text-slate-700"
                    >
                      {column.amount > 0 ? (
                        <>
                          {formatAllowance(column.amount)}{" "}
                          <span className="font-semibold text-slate-500">
                            ({column.count})
                          </span>
                        </>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="px-5 text-right font-bold text-teal-700">
                    {formatAllowance(allowanceSummary.total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CouncilCard>

        <CouncilCard interactive="none" className="mt-6 overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlarmClock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Late & Absent Calculation
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatPeriod(allowancePeriod)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Actual late minutes plus {ABSENT_PRAYER_LATE_MINUTES} minutes
                  for each absent prayer. Leave days are excluded.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="council-outline"
              className="h-10"
              onClick={downloadLateAbsentCSV}
              disabled={!lateAbsentAvailable || allowanceBusy}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {allowanceBusy ? (
            <div className="p-5 sm:p-6">
              <SkeletonReportsTable />
            </div>
          ) : allowanceError ? (
            <div className="p-5 sm:p-6">
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
            </div>
          ) : !lateAbsentAvailable ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records in this period"
                description={`No mosque attendance sheets were found from ${formatPeriod(allowancePeriod)}.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="min-w-[230px] px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Name
                  </TableHead>
                  {lateAbsentColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className="min-w-[110px] text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[130px] px-5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lateAbsentData.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="border-slate-100 hover:bg-rose-50/30"
                  >
                    <TableCell className="px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-xs font-bold text-rose-700">
                          {initials(employee.name)}
                        </div>
                        <p className="font-semibold text-slate-900">
                          {employee.name}
                        </p>
                      </div>
                    </TableCell>
                    {lateAbsentColumns.map((column) => {
                      const minutes = employee[column.key];
                      const absences = employee.absentCounts[column.key];
                      return (
                        <TableCell
                          key={column.key}
                          className="text-center font-semibold text-slate-700"
                        >
                          {minutes > 0 ? (
                            <>
                              {minutes}{" "}
                              <span className="font-medium text-slate-500">
                                min
                              </span>
                              {absences > 0 ? (
                                <span className="ml-1 font-medium text-rose-600">
                                  ({absences} abs)
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="font-medium text-slate-400">0</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-5 text-right font-bold text-rose-700">
                      {formatDuration(employee.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableCell className="px-5 font-bold text-slate-900">
                    Report total
                  </TableCell>
                  {lateAbsentSummary.prayerTotals.map((column) => (
                    <TableCell
                      key={column.key}
                      className="text-center font-bold text-slate-700"
                    >
                      {column.minutes > 0 ? (
                        <>
                          {column.minutes} min
                          {column.absentCount > 0 ? (
                            <span className="ml-1 font-semibold text-rose-600">
                              ({column.absentCount} abs)
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="px-5 text-right font-bold text-rose-700">
                    {formatDuration(lateAbsentSummary.total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CouncilCard>
      </div>
    </PageShell>
  );
}
