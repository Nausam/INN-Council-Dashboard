"use client";

import { CouncilCard } from "@/components/design-system/council-card";
import { EmptyState } from "@/components/design-system/empty-state";
import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reverseLeaveTypeMapping } from "@/constants";
import {
  useEmployeesQuery,
  useMosqueAssistantsQuery,
  useMosqueDailyAttendanceMonthQuery,
} from "@/hooks/queries";
import {
  fetchAllEmployees,
  fetchMosqueAssistants,
} from "@/lib/actions/hr.actions";
import { isOnAttendanceLeave } from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  CalendarSearch,
  CheckCircle2,
  CircleOff,
  Download,
  FileText,
  RefreshCw,
  UserRound,
} from "lucide-react";
import React, { useMemo, useState } from "react";

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

function formatMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return "Select a month";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
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

function getDailyStatusLabel(
  recordedForDay: number,
  leaveType: string | null,
): string {
  if (isOnAttendanceLeave(leaveType)) return formatLeaveLabel(leaveType);
  if (recordedForDay === PRAYERS.length) return "Complete";
  if (recordedForDay === 0) return "No check-ins";
  return "Partial";
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

function PrayerTimeCell({
  value,
  minutesLate,
  leaveType,
}: {
  value: string | null;
  minutesLate: number;
  leaveType: string | null;
}) {
  if (!value) {
    if (isOnAttendanceLeave(leaveType)) {
      const leaveLabel = formatLeaveLabel(leaveType);
      return (
        <div className="mx-auto flex min-w-[112px] flex-col items-center rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-inset ring-sky-100">
          <span className="text-xs font-bold text-sky-800">On leave</span>
          <span className="mt-0.5 text-center text-[10px] font-medium text-sky-600">
            {leaveLabel}
          </span>
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-w-[112px] flex-col items-center rounded-xl bg-rose-50 px-3 py-2 ring-1 ring-inset ring-rose-100">
        <span className="text-xs font-bold text-rose-700">Not signed in</span>
        <span className="mt-0.5 text-[10px] font-medium text-rose-500">Absent</span>
      </div>
    );
  }

  const late = minutesLate > 0;
  return (
    <div
      className={cn(
        "mx-auto flex min-w-[112px] flex-col items-center rounded-xl px-3 py-2 ring-1 ring-inset",
        late
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-teal-50 text-teal-700 ring-teal-100",
      )}
    >
      <span className="text-sm font-bold">{formatTime(value)}</span>
      <span className="mt-0.5 text-[10px] font-semibold">
        {late ? `+${minutesLate} min late` : "On time"}
      </span>
    </div>
  );
}

export function MosqueDailyReportsView({
  initialAssistants,
  initialEmployees,
}: {
  initialAssistants?: Awaited<ReturnType<typeof fetchMosqueAssistants>>;
  initialEmployees?: Awaited<ReturnType<typeof fetchAllEmployees>>;
}) {
  const currentMonth = useMemo(getMaldivesMonth, []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reportMonth, setReportMonth] = useState("");
  const [reportEmployeeId, setReportEmployeeId] = useState("");

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
  } = useMosqueDailyAttendanceMonthQuery(reportMonth, reportEmployeeId);

  const attendanceData = useMemo(
    () =>
      reportMonth && reportEmployeeId
        ? normalizeAttendanceRows(rawAttendance).filter((row) =>
            row.date.slice(0, 10).startsWith(`${reportMonth}-`),
          )
        : [],
    [rawAttendance, reportMonth, reportEmployeeId],
  );

  const reportEmployee = useMemo(
    () => employees.find((employee) => employee.$id === reportEmployeeId),
    [employees, reportEmployeeId],
  );

  const selectedEmployeeDetails = useMemo(
    () => employees.find((employee) => employee.$id === selectedEmployee),
    [employees, selectedEmployee],
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
    Boolean(reportMonth && reportEmployeeId) && (isLoading || isFetching);
  const reportAvailable =
    Boolean(reportEmployeeId) && isSuccess && !isError && attendanceData.length > 0;

  const handleGenerateReport = () => {
    if (!selectedEmployee) return;
    if (
      reportMonth === selectedMonth &&
      reportEmployeeId === selectedEmployee
    ) {
      void refetch();
      return;
    }
    setReportMonth(selectedMonth);
    setReportEmployeeId(selectedEmployee);
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
      "Daily Status",
    ];

    const rows = attendanceData.map((row) => {
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
          onLeave && !row[prayer.timeKey] ? "" : row[prayer.lateKey],
        ]),
        onLeave ? "On leave" : `${recordedForDay}/${PRAYERS.length}`,
        getDailyStatusLabel(recordedForDay, row.leaveType),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Mosque_Daily_Attendance_${reportMonth}_${reportEmployee.name.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell maxWidth="full">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          icon={FileText}
          title="Mosque Daily Attendance Report"
          subtitle="Review an employee's prayer check-ins, absences, and late arrivals by day"
          className="mb-8"
        />

        <CouncilCard
          interactive="none"
          className="mb-6 overflow-hidden border border-teal-100 p-0"
        >
          <div className="grid xl:grid-cols-[minmax(300px,0.8fr)_minmax(600px,1.2fr)]">
            <div className="flex items-center gap-4 bg-gradient-to-r from-teal-50 via-white to-white p-5 sm:p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-600/20">
                {selectedEmployeeDetails ? (
                  <span className="text-sm font-bold">
                    {employeeInitials(selectedEmployeeDetails.name)}
                  </span>
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                  Report selection
                </p>
                <p className="mt-1 truncate text-lg font-bold text-slate-950 sm:text-xl">
                  {selectedEmployeeDetails?.name || "Choose an employee"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedEmployeeDetails?.designation || "Mosque attendance"}
                  {selectedMonth ? ` · ${formatMonth(selectedMonth)}` : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-white p-5 sm:p-6 xl:border-l xl:border-t-0">
              <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr_auto] md:items-end">
                <div>
                  <label
                    htmlFor="daily-report-month"
                    className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Month
                  </label>
                  <input
                    id="daily-report-month"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="daily-report-employee"
                    className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Employee
                  </label>
                  <select
                    id="daily-report-employee"
                    value={selectedEmployee}
                    onChange={(event) => setSelectedEmployee(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  >
                    <option value="">
                      {assistantsPending ? "Loading employees..." : "Select employee"}
                    </option>
                    {employees.map((employee) => (
                      <option key={employee.$id} value={employee.$id}>
                        {employee.name}
                        {employee.designation ? ` — ${employee.designation}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="council"
                  className="h-11 px-5"
                  onClick={handleGenerateReport}
                  disabled={!selectedEmployee || loading}
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
            icon={CalendarDays}
            label="Attendance days"
            value={String(attendanceData.length)}
            detail={`${summary.completeDays} day${summary.completeDays === 1 ? "" : "s"} fully recorded`}
            tone="blue"
          />
          <StatCard
            icon={CheckCircle2}
            label="Recorded check-ins"
            value={String(summary.recorded)}
            detail={`${summary.attendanceRate}% of expected prayer check-ins`}
            tone="teal"
          />
          <StatCard
            icon={AlertTriangle}
            label="Late check-ins"
            value={String(summary.late)}
            detail="Saved check-ins marked late"
            tone="amber"
          />
          <StatCard
            icon={CircleOff}
            label="Missing check-ins"
            value={String(summary.missing)}
            detail={
              summary.leaveDays > 0
                ? `Excludes ${summary.leaveDays} leave day${summary.leaveDays === 1 ? "" : "s"}`
                : "Prayer entries with no saved timing"
            }
            tone="rose"
          />
        </div>

        <CouncilCard interactive="none" className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {reportEmployee
                  ? `${reportEmployee.name}'s daily register`
                  : "Daily attendance register"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {reportMonth
                  ? `${formatMonth(reportMonth)} · Saved timings are shown in Maldives attendance time`
                  : "Choose an employee and month to generate the report"}
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
                title="The daily report could not be loaded"
                description="Check the connection and generate the report again."
                action={
                  <Button variant="council" onClick={() => void refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : !reportEmployeeId ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={UserRound}
                title="Select an employee"
                description="Choose a mosque employee and month above, then generate the daily attendance report."
              />
            </div>
          ) : !reportAvailable ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={CalendarSearch}
                title="No attendance records found"
                description={`No mosque attendance sheets were found for ${reportEmployee?.name || "this employee"} in ${formatMonth(reportMonth)}.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-14 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    #
                  </TableHead>
                  <TableHead className="min-w-[150px] text-xs font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="min-w-[110px] text-xs font-bold uppercase tracking-wider text-slate-500">
                    Day
                  </TableHead>
                  {PRAYERS.map((prayer) => (
                    <TableHead
                      key={prayer.label}
                      className="min-w-[145px] text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {prayer.label}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[135px] px-5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Daily status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((row, index) => {
                  const recordedForDay = PRAYERS.filter(
                    (prayer) => row[prayer.timeKey],
                  ).length;
                  const onLeave = isOnAttendanceLeave(row.leaveType);
                  const complete = !onLeave && recordedForDay === PRAYERS.length;
                  const absent = !onLeave && recordedForDay === 0;
                  const dailyStatus = getDailyStatusLabel(
                    recordedForDay,
                    row.leaveType,
                  );

                  return (
                    <TableRow
                      key={row.$id}
                      className="border-slate-100 hover:bg-teal-50/30"
                    >
                      <TableCell className="px-5 font-medium text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-slate-900">
                          {formatDate(row.date)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-500">
                        {formatWeekday(row.date)}
                      </TableCell>
                      {PRAYERS.map((prayer) => (
                        <TableCell key={prayer.label} className="text-center">
                          <PrayerTimeCell
                            value={row[prayer.timeKey]}
                            minutesLate={row[prayer.lateKey]}
                            leaveType={row.leaveType}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="px-5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                              onLeave
                                ? "bg-sky-50 text-sky-800 ring-sky-100"
                                : complete
                                  ? "bg-teal-50 text-teal-700 ring-teal-100"
                                  : absent
                                    ? "bg-rose-50 text-rose-700 ring-rose-100"
                                    : "bg-amber-50 text-amber-700 ring-amber-100",
                            )}
                          >
                            {dailyStatus}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {onLeave
                              ? "Leave day"
                              : `${recordedForDay}/${PRAYERS.length} prayers`}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CouncilCard>
      </div>
    </PageShell>
  );
}
