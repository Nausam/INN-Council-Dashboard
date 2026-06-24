"use client";

import { AvatarGlow, EmptyState } from "@/components/design-system";
import { reverseLeaveTypeMapping } from "@/constants";
import {
  useEmployeeLeaveCalendarQuery,
  useEmployeeQuery,
} from "@/hooks/queries";
import type { EmployeeLeaveCalendarEntry } from "@/lib/firebase/hr";
import {
  ADDITIVE_LEAVE_KEYS,
  LEAVE_TOTAL_ALLOWANCE,
  getLeaveUsageSummary,
} from "@/lib/employees/leave-usage";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LeaveCalendarEntryWithAmount = EmployeeLeaveCalendarEntry & {
  amountLabel: string;
};

const LEAVE_STYLES: Record<string, string> = {
  sickLeave: "bg-red-50 text-red-700 ring-red-100",
  certificateSickLeave: "bg-rose-50 text-rose-700 ring-rose-100",
  annualLeave: "bg-blue-50 text-blue-700 ring-blue-100",
  familyRelatedLeave: "bg-amber-50 text-amber-700 ring-amber-100",
  maternityLeave: "bg-pink-50 text-pink-700 ring-pink-100",
  preMaternityLeave: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100",
  paternityLeave: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  noPayLeave: "bg-slate-100 text-slate-700 ring-slate-200",
  officialLeave: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

const LEAVE_DOTS: Record<string, string> = {
  sickLeave: "bg-red-500",
  certificateSickLeave: "bg-rose-500",
  annualLeave: "bg-blue-500",
  familyRelatedLeave: "bg-amber-500",
  maternityLeave: "bg-pink-500",
  preMaternityLeave: "bg-fuchsia-500",
  paternityLeave: "bg-cyan-500",
  noPayLeave: "bg-slate-400",
  officialLeave: "bg-emerald-500",
};

function leaveDot(type: string): string {
  return LEAVE_DOTS[type] ?? "bg-slate-400";
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function dateKey(date: Date): string {
  return `${monthKey(date)}-${pad(date.getDate())}`;
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function leaveLabel(type: string): string {
  return String(reverseLeaveTypeMapping[type] ?? type);
}

function leaveClass(type: string): string {
  return LEAVE_STYLES[type] ?? "bg-slate-50 text-slate-700 ring-slate-100";
}

function numericField(source: unknown, key: string): number {
  const value = (source as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function leaveAmountLabel(source: unknown, leaveType: string): string {
  const usage = getLeaveUsageSummary(leaveType, numericField(source, leaveType));
  if (usage.remaining !== null) {
    return `${usage.used}/${usage.remaining}`;
  }
  return String(usage.used);
}

function leaveAmountLabelFromSnapshot(
  entry: EmployeeLeaveCalendarEntry,
): string | null {
  const leaveType = entry.leaveType;
  const totalAllowance = LEAVE_TOTAL_ALLOWANCE[leaveType];

  if (ADDITIVE_LEAVE_KEYS.has(leaveType)) {
    return typeof entry.leaveUsedAfter === "number"
      ? String(entry.leaveUsedAfter)
      : null;
  }

  if (totalAllowance !== undefined) {
    if (typeof entry.leaveRemainingAfter !== "number") return null;
    const remaining = Math.max(0, entry.leaveRemainingAfter);
    const used = Math.max(0, totalAllowance - remaining);
    return `${used}/${remaining}`;
  }

  return typeof entry.leaveUsedAfter === "number"
    ? String(entry.leaveUsedAfter)
    : null;
}

function buildLeaveLedgerEntries(
  entries: EmployeeLeaveCalendarEntry[],
  employee: unknown,
): LeaveCalendarEntryWithAmount[] {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.$id.localeCompare(b.$id),
  );
  const seenByType = new Map<string, number>();

  return sorted.map((entry) => {
    const leaveType = entry.leaveType;
    const seen = (seenByType.get(leaveType) ?? 0) + 1;
    seenByType.set(leaveType, seen);

    const currentValue = numericField(employee, leaveType);
    const totalAllowance = LEAVE_TOTAL_ALLOWANCE[leaveType];
    let amountLabel = leaveAmountLabelFromSnapshot(entry);

    if (amountLabel) {
      return {
        ...entry,
        amountLabel,
      };
    }

    if (ADDITIVE_LEAVE_KEYS.has(leaveType)) {
      amountLabel = String(currentValue + seen);
    } else if (totalAllowance !== undefined) {
      const remaining = Math.max(0, currentValue - seen);
      const used = Math.max(0, totalAllowance - remaining);
      amountLabel = `${used}/${remaining}`;
    } else {
      amountLabel = String(currentValue);
    }

    return {
      ...entry,
      amountLabel,
    };
  });
}

function buildCalendarDates(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

export default function EmployeeLeaveCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [monthInitialized, setMonthInitialized] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const goToMonth = (date: Date) => {
    setVisibleMonth(date);
    setSelectedKey(null);
  };

  const { data: employee, isPending: employeePending, isError } =
    useEmployeeQuery(id);
  const { data: leaves = [], isPending: leavesPending } =
    useEmployeeLeaveCalendarQuery(id);

  const ledgerLeaves = useMemo(
    () => buildLeaveLedgerEntries(leaves, employee),
    [employee, leaves],
  );

  useEffect(() => {
    if (monthInitialized || ledgerLeaves.length === 0) return;
    const latest = ledgerLeaves[ledgerLeaves.length - 1];
    if (!latest) return;
    const [year, month] = latest.date.split("-").map(Number);
    setVisibleMonth(new Date(year, month - 1, 1));
    setMonthInitialized(true);
  }, [ledgerLeaves, monthInitialized]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntryWithAmount[]>();
    for (const entry of ledgerLeaves) {
      const rows = map.get(entry.date) ?? [];
      rows.push(entry);
      map.set(entry.date, rows);
    }
    return map;
  }, [ledgerLeaves]);

  const currentMonthKey = monthKey(visibleMonth);
  const monthRecords = useMemo(
    () => ledgerLeaves.filter((entry) => entry.date.startsWith(currentMonthKey)),
    [currentMonthKey, ledgerLeaves],
  );

  const leaveTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of ledgerLeaves) {
      counts.set(entry.leaveType, (counts.get(entry.leaveType) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) =>
      leaveLabel(a[0]).localeCompare(leaveLabel(b[0])),
    );
  }, [ledgerLeaves]);

  const calendarCells = useMemo(
    () => buildCalendarDates(visibleMonth),
    [visibleMonth],
  );

  const monthTitle = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const todayKey = dateKey(new Date());
  const visibleRecords =
    selectedKey !== null
      ? recordsByDate.get(selectedKey) ?? []
      : monthRecords;

  const loading = employeePending || leavesPending;

  if (isError || (!loading && !employee)) {
    return (
      <div className="min-h-screen bg-[#f4f6f4] px-4 py-6">
        <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
        <div className="mx-auto max-w-5xl">
          <BackButton onClick={() => router.back()} />
          <EmptyState
            icon={User}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f4] px-4 pb-12 pt-6">
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className="mx-auto max-w-5xl space-y-5">
        <BackButton onClick={() => router.back()} />

        {/* Hero */}
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-100">
          <div className="bg-gradient-to-br from-teal-600 to-emerald-500 px-6 pb-12 pt-6 text-white">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/80">
              <CalendarDays className="h-4 w-4" />
              Leave calendar
            </p>
            <div className="mt-3 flex items-center gap-4">
              {employee ? (
                <AvatarGlow
                  name={employee.name}
                  size="lg"
                  className="h-16 w-16 rounded-[22px] text-2xl ring-4 ring-white/30"
                />
              ) : (
                <div className="h-16 w-16 animate-pulse rounded-[22px] bg-white/30" />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight">
                  {employee?.name ?? "Loading"}
                </h1>
                <p className="truncate text-sm font-bold text-white/85">
                  {employee?.designation ?? ""}
                  {employee?.section ? ` · ${employee.section}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Floating stats */}
          <div className="-mt-8 grid grid-cols-2 gap-3 px-4 pb-4">
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
              <p className="text-2xl font-black tabular-nums text-slate-900">
                {leaves.length}
              </p>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Total leaves
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
              <p className="text-2xl font-black tabular-nums text-teal-600">
                {monthRecords.length}
              </p>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                This month
              </p>
            </div>
          </div>
        </section>

        {/* Calendar */}
        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {monthTitle}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
                onClick={() =>
                  goToMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-9 items-center rounded-full bg-slate-50 px-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
                onClick={() => goToMonth(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
                onClick={() =>
                  goToMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAY_INITIALS.map((day, i) => (
              <div
                key={i}
                className="pb-1 text-center text-[11px] font-black uppercase text-slate-400"
              >
                {day}
              </div>
            ))}

            {calendarCells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} />;
              const key = dateKey(date);
              const dayRecords = recordsByDate.get(key) ?? [];
              const hasLeave = dayRecords.length > 0;
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!hasLeave}
                  onClick={() =>
                    setSelectedKey((prev) => (prev === key ? null : key))
                  }
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl text-sm font-black tabular-nums transition",
                    isSelected
                      ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                      : hasLeave
                        ? "bg-teal-50 text-slate-900 ring-1 ring-teal-100 active:scale-95"
                        : "text-slate-400",
                    isToday && !isSelected && "ring-2 ring-teal-400",
                  )}
                >
                  {date.getDate()}
                  {hasLeave ? (
                    <span className="flex h-1.5 items-center gap-0.5">
                      {dayRecords.slice(0, 3).map((entry, i) => (
                        <span
                          key={`${entry.$id}-${i}`}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-white" : leaveDot(entry.leaveType),
                          )}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="h-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Records */}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {selectedKey ? formatDateLabel(selectedKey) : `${monthTitle}`}
            </h2>
            {selectedKey ? (
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200 transition active:scale-95"
              >
                Show month
              </button>
            ) : null}
          </div>

          {visibleRecords.length > 0 ? (
            <div className="space-y-2">
              {visibleRecords.map((entry) => (
                <div
                  key={`${entry.source}-${entry.$id}`}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                      leaveClass(entry.leaveType),
                    )}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        leaveDot(entry.leaveType),
                      )}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {leaveLabel(entry.leaveType)}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {formatDateLabel(entry.date)} · {entry.source}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums ring-1",
                      leaveClass(entry.leaveType),
                    )}
                  >
                    {entry.amountLabel}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">
              {selectedKey
                ? "No leaves on this day."
                : "No leaves in this month."}
            </p>
          )}
        </section>

        {/* Leave type summary */}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-lg font-black tracking-tight text-slate-900">
            Leave types
          </h2>
          {leaveTypeCounts.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {leaveTypeCounts.map(([type]) => (
                <div
                  key={type}
                  className="flex items-center gap-2.5 rounded-2xl bg-slate-50 p-3"
                >
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", leaveDot(type))}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">
                    {leaveLabel(type)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums ring-1",
                      leaveClass(type),
                    )}
                  >
                    {leaveAmountLabel(employee, type)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">
              No leave records found.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
