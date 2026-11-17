"use client";

import { EmptyState } from "@/components/design-system/empty-state";
import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";
import { Button } from "@/components/ui/button";
import { reverseLeaveTypeMapping } from "@/constants";
import {
  useEmployeesQuery,
  useMosqueAssistantsQuery,
  useMosqueDailyAttendanceRangeQuery,
} from "@/hooks/queries";
import {
  fetchAllEmployees,
  fetchMosqueAssistants,
} from "@/lib/actions/hr.actions";
import {
  downloadMosqueDailyPdf,
  type MosqueDailyCell,
} from "@/lib/attendance/mosque-daily-pdf";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { isOnAttendanceLeave } from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import {
  CalendarDays,
  CalendarSearch,
  Check,
  CheckCircle2,
  CircleOff,
  Clock3,
  Download,
  FileDown,
  FileText,
  Hourglass,
  Loader2,
  Palmtree,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./mosque-daily-report.module.css";

type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      designation?: string;
    };

type AttendanceRow = {
  $id: string;
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

type MosqueEmployee = {
  $id: string;
  name: string;
  designation: string;
};

type RawEmployee = {
  $id?: unknown;
  id?: unknown;
  name?: unknown;
  employeeName?: unknown;
  section?: unknown;
  designation?: unknown;
  documents?: unknown;
};

type WithDocuments = { documents: unknown[] };

const PRAYERS = [
  {
    label: "Fajr",
    timeKey: "fathisSignInTime",
    lateKey: "fathisMinutesLate",
  },
  {
    label: "Dhuhr",
    timeKey: "mendhuruSignInTime",
    lateKey: "mendhuruMinutesLate",
  },
  {
    label: "Asr",
    timeKey: "asuruSignInTime",
    lateKey: "asuruMinutesLate",
  },
  {
    label: "Maghrib",
    timeKey: "maqribSignInTime",
    lateKey: "maqribMinutesLate",
  },
  {
    label: "Isha",
    timeKey: "ishaSignInTime",
    lateKey: "ishaMinutesLate",
  },
] as const;

/** Fixed employee order for the daily report selector. */
const DAILY_REPORT_STAFF_ORDER = [
  "mohamed mahir",
  "ibrahim waseem",
  "ibrahim hashim",
  "hawwa luiza",
] as const;

function dailyReportStaffRank(name: string): number {
  const normalized = name.trim().toLowerCase();
  return DAILY_REPORT_STAFF_ORDER.findIndex((entry) => entry === normalized);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDocuments(value: unknown): value is WithDocuments {
  return (
    isObject(value) &&
    "documents" in value &&
    Array.isArray((value as { documents?: unknown[] }).documents)
  );
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
  return typeof value === "string" ? value : null;
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

function getEmployeeRef(value: unknown): EmployeeRef | null {
  if (typeof value === "string") return value;
  if (!isObject(value)) return null;

  const $id = getString(value, "$id");
  const name = getString(value, "name");
  const designation = getString(value, "designation") || undefined;
  return $id && name ? { $id, name, designation } : null;
}

function normalizeEmployee(
  row: unknown,
  requireMosqueFields: boolean,
): MosqueEmployee | null {
  if (!isObject(row)) return null;
  const raw = row as RawEmployee;
  const id =
    typeof raw.$id === "string"
      ? raw.$id
      : typeof raw.id === "string"
        ? raw.id
        : "";
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.employeeName === "string" && raw.employeeName.trim()
        ? raw.employeeName.trim()
        : "";
  const section =
    typeof raw.section === "string" ? raw.section.trim().toLowerCase() : "";
  const designation =
    typeof raw.designation === "string" ? raw.designation.trim() : "";
  const designationKey = designation.toLowerCase();

  if (!id || !name) return null;
  if (
    requireMosqueFields &&
    (section !== "mosque" ||
      (designationKey !== "imam" &&
        designationKey !== "council assistant"))
  ) {
    return null;
  }

  if (
    !requireMosqueFields &&
    ((section && section !== "mosque") ||
      (designationKey &&
        designationKey !== "imam" &&
        designationKey !== "council assistant"))
  ) {
    return null;
  }

  return { $id: id, name, designation };
}

function normalizeAttendanceRows(raw: unknown): AttendanceRow[] {
  if (!Array.isArray(raw)) return [];

  const rows: AttendanceRow[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const $id = getString(item, "$id");
    const date = getString(item, "date");
    const employeeId = getEmployeeRef(item.employeeId);
    if (!$id || !date || !employeeId) continue;

    rows.push({
      $id,
      date,
      employeeId,
      leaveType: getNullableString(item, "leaveType"),
      fathisSignInTime: getNullableString(item, "fathisSignInTime"),
      mendhuruSignInTime: getNullableString(item, "mendhuruSignInTime"),
      asuruSignInTime: getNullableString(item, "asuruSignInTime"),
      maqribSignInTime: getNullableString(item, "maqribSignInTime"),
      ishaSignInTime: getNullableString(item, "ishaSignInTime"),
      fathisMinutesLate: getNumber(item, "fathisMinutesLate"),
      mendhuruMinutesLate: getNumber(item, "mendhuruMinutesLate"),
      asuruMinutesLate: getNumber(item, "asuruMinutesLate"),
      maqribMinutesLate: getNumber(item, "maqribMinutesLate"),
      ishaMinutesLate: getNumber(item, "ishaMinutesLate"),
    });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** The longest range the report covers at once. */
const MAX_RANGE_DAYS = 366;

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The current month in the Maldives, as its first and last day. */
function currentMonthRange(today: string): { start: string; end: string } {
  const [year, month] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

function rangeDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/** "October 2026" for a whole month, otherwise "28 Sep – 3 Oct 2026". */
function formatRange(start: string, end: string): string {
  if (!isIsoDate(start) || !isIsoDate(end)) return "Select dates";
  const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const wholeMonth =
    start.slice(0, 7) === end.slice(0, 7) &&
    start.endsWith("-01") &&
    end === currentMonthRange(start).end;
  if (wholeMonth) return format(start, { month: "long", year: "numeric" });
  if (start === end) return format(start, { day: "numeric", month: "short", year: "numeric" });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${format(start, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })} – ${format(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function formatTime(value: string | null): string {
  if (!value) return "Not signed in";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

function formatLeaveLabel(leaveType: string | null | undefined): string {
  const key = (leaveType ?? "").trim();
  if (!key) return "";
  return (
    reverseLeaveTypeMapping[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()).trim()
  );
}

function formatPrayerStatus(
  value: string | null,
  leaveType: string | null,
): string {
  if (value) return formatTime(value);
  if (isOnAttendanceLeave(leaveType)) return formatLeaveLabel(leaveType);
  return "Not signed in";
}

/** A prayer not signed in counts as this many minutes late. */
const ABSENT_PRAYER_MINUTES = 60;

/**
 * Each prayer's cell and the day's late minutes: late minutes for each
 * sign-in plus 60 for each prayer not signed in. Leave days count nothing
 * (total null); today's prayers not signed in yet aren't counted.
 */
function dayLateMinutes(
  row: AttendanceRow,
  today: string,
): { cells: MosqueDailyCell[]; total: number | null } {
  if (isOnAttendanceLeave(row.leaveType)) {
    const label = formatLeaveLabel(row.leaveType);
    return {
      cells: PRAYERS.map(() => ({ kind: "leave", text: "On leave", note: label })),
      total: null,
    };
  }
  let total = 0;
  const cells = PRAYERS.map((prayer): MosqueDailyCell => {
    const signedIn = row[prayer.timeKey];
    if (signedIn) {
      const late = Math.max(0, row[prayer.lateKey]);
      total += late;
      return late > 0
        ? { kind: "late", text: formatTime(signedIn), note: `+${late} min` }
        : { kind: "time", text: formatTime(signedIn), note: "On time" };
    }
    if (row.date.slice(0, 10) >= today) return { kind: "pending", text: "Not yet", note: "" };
    total += ABSENT_PRAYER_MINUTES;
    return { kind: "absent", text: "Not signed in", note: `${ABSENT_PRAYER_MINUTES} min` };
  });
  return { cells, total };
}

function employeeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** A day's overall status, shown as its tile and calendar-page color. */
type DayTone = "present" | "late" | "missed" | "leave" | "pending";

function dayTone(day: { cells: MosqueDailyCell[]; total: number | null }): DayTone {
  if (day.total === null) return "leave";
  if (day.cells.some((cell) => cell.kind === "absent")) return "missed";
  if (day.cells.some((cell) => cell.kind === "late")) return "late";
  if (day.cells.every((cell) => cell.kind === "pending")) return "pending";
  return "present";
}

/** Glossy icon tile in the employee-portal style, including the rose "missed" tone. */
function GlossTile({
  tone,
  icon: Icon,
  className,
}: {
  tone: DayTone | "annual";
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
  meter,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  /** Small pill beside the value, e.g. the same amount in hours. */
  aside?: string;
  detail: string;
  tone: "annual" | "present" | "late" | "missed";
  meter?: number;
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <GlossTile tone={tone} icon={icon} className={styles.statIcon} />
      <div className={styles.statBody}>
        <p className={styles.label}>{label}</p>
        <p className={styles.statValue}>
          {value}
          {unit ? <small>{unit}</small> : null}
          {aside ? <span className={styles.statAside}>{aside}</span> : null}
        </p>
        {meter !== undefined ? (
          <div className={styles.meter} aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
          </div>
        ) : null}
        <p className={styles.statDetail}>{detail}</p>
      </div>
    </div>
  );
}

const CELL_ICON: Record<MosqueDailyCell["kind"], { tone: DayTone; icon: React.ComponentType<{ className?: string }> }> = {
  time: { tone: "present", icon: Check },
  late: { tone: "late", icon: Clock3 },
  absent: { tone: "missed", icon: X },
  leave: { tone: "leave", icon: Palmtree },
  pending: { tone: "pending", icon: Hourglass },
};

function PrayerTimeCell({ cell }: { cell: MosqueDailyCell }) {
  const { tone, icon } = CELL_ICON[cell.kind];
  return (
    <div className={styles.prayer} data-kind={cell.kind}>
      <GlossTile tone={tone} icon={icon} className={styles.prayerIcon} />
      <span className={styles.prayerText}>
        <strong>{cell.text}</strong>
        {cell.note ? <span>{cell.note}</span> : null}
      </span>
    </div>
  );
}

function shortDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
}

/** First and last day of the month `delta` months from today's. */
function monthRangeFrom(today: string, delta: number): { start: string; end: string } {
  const [year, month] = today.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
  return currentMonthRange(first);
}

/** 1531 → "25 h 31 min"; whole hours drop the minutes. */
function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export function MosqueDailyReportsView({
  initialAssistants,
  initialEmployees,
}: {
  initialAssistants?: Awaited<ReturnType<typeof fetchMosqueAssistants>>;
  initialEmployees?: Awaited<ReturnType<typeof fetchAllEmployees>>;
}) {
  const today = useMemo(maldivesTodayIso, []);
  const [fromDate, setFromDate] = useState(() => currentMonthRange(today).start);
  const [toDate, setToDate] = useState(() => currentMonthRange(today).end);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reportRange, setReportRange] = useState<{ start: string; end: string } | null>(null);
  const [reportEmployeeId, setReportEmployeeId] = useState("");
  const [makingPdf, setMakingPdf] = useState(false);
  const [formHint, setFormHint] = useState<string | null>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const presets = useMemo(
    () => [
      { key: "this", label: "This month", ...currentMonthRange(today) },
      { key: "last", label: "Last month", ...monthRangeFrom(today, -1) },
      { key: "30", label: "Last 30 days", start: daysBefore(today, 29), end: today },
    ],
    [today],
  );
  const reportLabel = reportRange ? formatRange(reportRange.start, reportRange.end) : "";

  const {
    data: assistantsResponse,
    isPending: assistantsPending,
  } = useMosqueAssistantsQuery({ initialData: initialAssistants });
  const { data: allEmployees = [] } = useEmployeesQuery({
    initialData: initialEmployees,
  });

  const employees = useMemo(() => {
    const raw: unknown = assistantsResponse;
    let rows: unknown[] = [];
    if (Array.isArray(raw)) rows = raw;
    else if (hasDocuments(raw)) rows = raw.documents;

    let result = rows
      .map((row) => normalizeEmployee(row, false))
      .filter((employee): employee is MosqueEmployee => employee !== null);

    if (result.length === 0) {
      result = allEmployees
        .map((row) => normalizeEmployee(row, true))
        .filter((employee): employee is MosqueEmployee => employee !== null);
    }

    return result
      .filter((employee) => dailyReportStaffRank(employee.name) >= 0)
      .sort(
        (a, b) => dailyReportStaffRank(a.name) - dailyReportStaffRank(b.name),
      );
  }, [assistantsResponse, allEmployees]);

  const {
    data: rawAttendance,
    isLoading,
    isFetching,
    isError,
    isSuccess,
    refetch,
  } = useMosqueDailyAttendanceRangeQuery(
    reportRange?.start ?? "",
    reportRange?.end ?? "",
    reportEmployeeId,
  );

  const attendanceData = useMemo(
    () =>
      reportRange && reportEmployeeId
        ? normalizeAttendanceRows(rawAttendance).filter((row) => {
            const date = row.date.slice(0, 10);
            return date >= reportRange.start && date <= reportRange.end && date <= today;
          })
        : [],
    [rawAttendance, reportRange, reportEmployeeId, today],
  );

  const dayTotals = useMemo(
    () => attendanceData.map((row) => dayLateMinutes(row, today)),
    [attendanceData, today],
  );
  const grandTotal = dayTotals.reduce((sum, day) => sum + (day.total ?? 0), 0);

  const reportEmployee = useMemo(
    () => employees.find((employee) => employee.$id === reportEmployeeId),
    [employees, reportEmployeeId],
  );

  const summary = useMemo(() => {
    let recorded = 0;
    let missing = 0;
    let late = 0;
    let completeDays = 0;
    let leaveDays = 0;
    let expectedPrayers = 0;

    for (const row of attendanceData) {
      if (isOnAttendanceLeave(row.leaveType)) {
        leaveDays += 1;
        continue;
      }

      let recordedForDay = 0;
      for (const prayer of PRAYERS) {
        expectedPrayers += 1;
        if (row[prayer.timeKey]) {
          recorded += 1;
          recordedForDay += 1;
          if (row[prayer.lateKey] > 0) late += 1;
        } else {
          missing += 1;
        }
      }
      if (recordedForDay === PRAYERS.length) completeDays += 1;
    }

    return {
      recorded,
      missing,
      late,
      completeDays,
      leaveDays,
      attendanceRate:
        expectedPrayers > 0
          ? Math.round((recorded / expectedPrayers) * 100)
          : 0,
    };
  }, [attendanceData]);

  const loading =
    Boolean(reportRange && reportEmployeeId) && (isLoading || isFetching);
  const reportAvailable =
    Boolean(reportEmployeeId) && isSuccess && !isError && attendanceData.length > 0;

  // A choice made before the page finished loading, or one the browser
  // restored after a reload, shows in the fields without reaching React's
  // state; pick it up so Generate uses what the fields show.
  useEffect(() => {
    const shownFrom = fromRef.current?.value ?? "";
    if (isIsoDate(shownFrom) && shownFrom !== fromDate) setFromDate(shownFrom);
    const shownTo = toRef.current?.value ?? "";
    if (isIsoDate(shownTo) && shownTo !== toDate) setToDate(shownTo);
    // Only when the fields first appear and when the employee list arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  /** The dates the fields show, which can be ahead of React state after a restore. */
  const shownRange = () => {
    const shownFrom = fromRef.current?.value ?? "";
    const shownTo = toRef.current?.value ?? "";
    return {
      start: isIsoDate(shownFrom) ? shownFrom : fromDate,
      end: isIsoDate(shownTo) ? shownTo : toDate,
    };
  };

  const runReport = (employeeId: string, start: string, end: string) => {
    if (!employeeId) {
      setFormHint("Choose an employee first.");
      return;
    }
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
      setFormHint("Choose a From date on or before the To date.");
      return;
    }
    if (rangeDays(start, end) > MAX_RANGE_DAYS) {
      setFormHint(`Choose ${MAX_RANGE_DAYS} days or fewer.`);
      return;
    }
    setFormHint(null);
    if (employeeId !== selectedEmployee) setSelectedEmployee(employeeId);
    if (start !== fromDate) setFromDate(start);
    if (end !== toDate) setToDate(end);
    if (reportRange?.start === start && reportRange.end === end && reportEmployeeId === employeeId) {
      void refetch();
      return;
    }
    setReportRange({ start, end });
    setReportEmployeeId(employeeId);
  };

  const handleGenerateReport = () => {
    const { start, end } = shownRange();
    runReport(selectedEmployee, start, end);
  };

  // Picking a person runs the report straight away for the dates shown.
  const pickEmployee = (employeeId: string) => {
    const { start, end } = shownRange();
    runReport(employeeId, start, end);
  };

  // A preset sets the dates, and reruns the report when someone is picked.
  const pickPreset = (start: string, end: string) => {
    setFromDate(start);
    setToDate(end);
    setFormHint(null);
    if (selectedEmployee) runReport(selectedEmployee, start, end);
  };

  const downloadCSV = () => {
    if (!reportAvailable || !reportEmployee) return;

    const headers = [
      "Date",
      "Day",
      "Employee Name",
      "Designation",
      ...PRAYERS.flatMap((prayer) => [
        `${prayer.label} Sign-In`,
        `${prayer.label} Late (mins)`,
      ]),
      "Recorded Prayers",
      "Total Late (mins)",
    ];

    const rows = attendanceData.map((row, index) => {
      const recordedForDay = PRAYERS.filter(
        (prayer) => row[prayer.timeKey],
      ).length;
      const onLeave = isOnAttendanceLeave(row.leaveType);
      return [
        row.date.slice(0, 10),
        formatWeekday(row.date),
        reportEmployee.name,
        reportEmployee.designation,
        ...PRAYERS.flatMap((prayer) => [
          formatPrayerStatus(row[prayer.timeKey], row.leaveType),
          row[prayer.timeKey]
            ? row[prayer.lateKey]
            : onLeave || row.date.slice(0, 10) >= today
              ? ""
              : ABSENT_PRAYER_MINUTES,
        ]),
        onLeave ? "On leave" : `${recordedForDay}/${PRAYERS.length}`,
        dayTotals[index].total ?? "Leave",
      ];
    });
    const footer = [
      "Grand Total",
      ...Array(headers.length - 2).fill(""),
      grandTotal,
    ];

    const csv = [headers, ...rows, footer]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Mosque_Daily_Attendance_${reportRange?.start}_to_${reportRange?.end}_${reportEmployee.name.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (!reportAvailable || !reportEmployee) return;
    setMakingPdf(true);
    try {
      await downloadMosqueDailyPdf({
        employeeName: reportEmployee.name,
        designation: reportEmployee.designation,
        monthLabel: reportLabel,
        prayerLabels: PRAYERS.map((prayer) => prayer.label),
        rows: attendanceData.map((row, index) => ({
          date: formatDate(row.date),
          day: formatWeekday(row.date),
          cells: dayTotals[index].cells,
          total: dayTotals[index].total,
        })),
        grandTotal,
        fileName: `Mosque_Daily_Attendance_${reportRange?.start}_to_${reportRange?.end}_${reportEmployee.name.replace(/\s+/g, "_")}.pdf`,
      });
    } finally {
      setMakingPdf(false);
    }
  };

  return (
    <PageShell maxWidth="full">
      <div className={cn("mx-auto max-w-[1500px]", styles.page)}>
        <PageHeader
          icon={FileText}
          title="Mosque Daily Attendance Report"
          subtitle="Review an employee's prayer check-ins, absences, and late arrivals by day"
          className="mb-8"
        />

        <section className={styles.selection} aria-label="Report selection">
          <div>
            <p className={styles.label}>Who</p>
            <div className={styles.people}>
              {employees.length === 0 ? (
                <p className={styles.personEmpty}>
                  {assistantsPending ? "Loading employees..." : "No mosque employees found."}
                </p>
              ) : (
                employees.map((employee, index) => (
                  <button
                    key={employee.$id}
                    type="button"
                    className={styles.person}
                    data-selected={employee.$id === selectedEmployee}
                    aria-pressed={employee.$id === selectedEmployee}
                    onClick={() => pickEmployee(employee.$id)}
                  >
                    <span className={styles.avatar} data-tint={index % 4}>
                      {employeeInitials(employee.name)}
                    </span>
                    <span className={styles.personText}>
                      <span className={styles.personName}>{employee.name}</span>
                      <span className={styles.personRole}>
                        {employee.designation || "Mosque staff"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <p className={styles.label}>When · {formatRange(fromDate, toDate)}</p>
            <div className={styles.when}>
              <div className={styles.presets}>
                {presets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={styles.preset}
                    data-active={preset.start === fromDate && preset.end === toDate}
                    onClick={() => pickPreset(preset.start, preset.end)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className={styles.dates}>
                <label className={styles.dateField} htmlFor="daily-report-from">
                  <span>From</span>
                  <input
                    ref={fromRef}
                    id="daily-report-from"
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(event) => {
                      const next = event.target.value;
                      setFromDate(next);
                      if (toDate && next > toDate) setToDate(next);
                      setFormHint(null);
                    }}
                    className={styles.dateInput}
                  />
                </label>
                <span className={styles.dateArrow} aria-hidden>→</span>
                <label className={styles.dateField} htmlFor="daily-report-to">
                  <span>To</span>
                  <input
                    ref={toRef}
                    id="daily-report-to"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setFormHint(null);
                    }}
                    className={styles.dateInput}
                  />
                </label>
              </div>

              <Button
                type="button"
                variant="council"
                className={cn("h-11 rounded-full px-5", styles.generate)}
                onClick={handleGenerateReport}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                {loading ? "Generating" : "Generate"}
              </Button>
            </div>
          </div>

          {formHint ? (
            <p className={styles.hint} role="alert">
              {formHint}
            </p>
          ) : null}
        </section>

        <div className={styles.stats}>
          <StatCard
            icon={CalendarDays}
            label="Attendance days"
            value={String(attendanceData.length)}
            detail={`${summary.completeDays} day${summary.completeDays === 1 ? "" : "s"} fully recorded`}
            tone="annual"
          />
          <StatCard
            icon={CheckCircle2}
            label="Recorded check-ins"
            value={String(summary.recorded)}
            detail={`${summary.attendanceRate}% of expected prayer check-ins`}
            tone="present"
            meter={summary.attendanceRate}
          />
          <StatCard
            icon={Clock3}
            label="Late minutes"
            value={String(reportAvailable ? grandTotal : 0)}
            unit="min"
            aside={reportAvailable && grandTotal >= 60 ? formatHoursMinutes(grandTotal) : undefined}
            detail={`${summary.late} late check-in${summary.late === 1 ? "" : "s"} · missed prayer = ${ABSENT_PRAYER_MINUTES} min`}
            tone="late"
          />
          <StatCard
            icon={CircleOff}
            label="Missing check-ins"
            value={String(summary.missing)}
            detail={
              summary.leaveDays > 0
                ? `Excludes ${summary.leaveDays} leave day${summary.leaveDays === 1 ? "" : "s"}`
                : "Prayers with no saved sign-in"
            }
            tone="missed"
          />
        </div>

        <section className={styles.register}>
          <div className={styles.registerHead}>
            <div>
              <h2 className={styles.registerTitle}>
                {reportEmployee
                  ? `${reportEmployee.name}'s daily register`
                  : "Daily attendance register"}
              </h2>
              <p className={styles.registerSub}>
                {reportRange
                  ? `${reportLabel} · Times are Maldives attendance time`
                  : "Pick a person and dates to see their days"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Button
                type="button"
                variant="council"
                className="h-10 rounded-full"
                onClick={() => void downloadPDF()}
                disabled={!reportAvailable || loading || makingPdf}
              >
                {makingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          </div>

          <div className={styles.registerBody}>
            {loading ? (
              <SkeletonReportsTable />
            ) : isError ? (
              <EmptyState
                icon={CalendarSearch}
                title="The daily report could not be loaded"
                description="Check the connection and generate the report again."
                action={
                  <Button variant="council" onClick={() => void refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : !reportEmployeeId ? (
              <EmptyState
                icon={UserRound}
                title="Pick someone to start"
                description="Tap a person above. Their report opens for the dates shown, and you can change the dates any time."
              />
            ) : !reportAvailable ? (
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records found"
                description={`No mosque attendance sheets were found for ${reportEmployee?.name || "this employee"} for ${reportLabel}.`}
              />
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        {PRAYERS.map((prayer) => (
                          <th key={prayer.label}>{prayer.label}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.map((row, index) => {
                        const date = row.date.slice(0, 10);
                        const recordedForDay = PRAYERS.filter(
                          (prayer) => row[prayer.timeKey],
                        ).length;
                        const { cells, total } = dayTotals[index];
                        const tone = dayTone(dayTotals[index]);

                        return (
                          <tr key={row.$id}>
                            <td>
                              <div className={styles.dateCell}>
                                <div
                                  className={cn(
                                    motifs.calendarPage,
                                    styles.datePage,
                                    tone === "missed" && styles.calendarMissed,
                                    tone === "pending" && styles.calendarPending,
                                  )}
                                  data-tone={tone === "missed" || tone === "pending" ? undefined : tone}
                                >
                                  <span className={motifs.calendarPageTop}>
                                    {shortDate(date, { weekday: "short" })}
                                  </span>
                                  <strong>{shortDate(date, { day: "numeric" })}</strong>
                                  <small>{shortDate(date, { month: "short", year: "2-digit" })}</small>
                                </div>
                                <div className={styles.dateText}>
                                  <strong>{formatWeekday(date)}</strong>
                                  <span>{date === today ? "Today" : formatDate(date)}</span>
                                </div>
                              </div>
                            </td>
                            {PRAYERS.map((prayer, prayerIndex) => (
                              <td key={prayer.label}>
                                <PrayerTimeCell cell={cells[prayerIndex]} />
                              </td>
                            ))}
                            <td>
                              {total === null ? (
                                <span className={styles.leavePill}>Leave</span>
                              ) : (
                                <div className={styles.total}>
                                  <strong data-late={total > 0}>{total} min</strong>
                                  <span>
                                    {recordedForDay}/{PRAYERS.length} prayers
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.footer}>
                  <p>
                    Total late minutes · {reportLabel}
                    <small>A prayer not signed in counts as {ABSENT_PRAYER_MINUTES} minutes</small>
                  </p>
                  <p className={styles.footerTotal}>
                    {grandTotal}
                    <small>min</small>
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
