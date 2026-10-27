"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmployeeLeaveDayInfo } from "@/lib/salary-slips/employee-leave-days";
import {
  employeeLeaveDaysMap,
  formatLeaveUsageCompact,
  shortLeaveLabel,
} from "@/lib/salary-slips/employee-leave-days";
import {
  formatPayPeriodRange,
  groupPayPeriodDatesByMonth,
  isWeekendWeekday,
  listPayPeriodDateEntries,
  type PayPeriodDateEntry,
} from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SalaryPeriodHolidaysPanelProps = {
  periodLabel: string;
  employeeId?: string;
  employeeName?: string;
};

function buildWeekRows(items: PayPeriodDateEntry[]): (PayPeriodDateEntry | null)[][] {
  if (items.length === 0) return [];

  const cells: (PayPeriodDateEntry | null)[] = [];
  for (let i = 0; i < items[0].weekday; i++) cells.push(null);
  for (const item of items) cells.push(item);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (PayPeriodDateEntry | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

/**
 * The pay period's public holidays and the employee's leave days, to explain
 * the attendance benefit. Holidays are marked in the Holiday Calendar on the
 * Admin page, so this only shows them.
 */
export function SalaryPeriodHolidaysPanel({
  periodLabel,
  employeeId,
  employeeName,
}: SalaryPeriodHolidaysPanelProps) {
  const [open, setOpen] = useState(false);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [leaveByDate, setLeaveByDate] = useState<
    Map<string, EmployeeLeaveDayInfo>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodRange = useMemo(
    () => (periodLabel ? formatPayPeriodRange(periodLabel) : ""),
    [periodLabel],
  );

  const dateEntries = useMemo(
    () => (periodLabel ? listPayPeriodDateEntries(periodLabel) : []),
    [periodLabel],
  );

  const monthGroups = useMemo(
    () => groupPayPeriodDatesByMonth(dateEntries),
    [dateEntries],
  );

  const loadConfig = useCallback(async () => {
    if (!periodLabel) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/salary-slips/period-config?period=${encodeURIComponent(periodLabel)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load holidays.");
        setHolidayDates(new Set());
        return;
      }
      const dates = Array.isArray(data.holidayDates)
        ? data.holidayDates.filter(
            (d: unknown): d is string =>
              typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
          )
        : [];
      setHolidayDates(new Set<string>(dates));
    } catch {
      setError("Failed to load holidays.");
      setHolidayDates(new Set());
    } finally {
      setLoading(false);
    }
  }, [periodLabel]);

  const loadLeaveDays = useCallback(async () => {
    if (!periodLabel || !employeeId) {
      setLeaveByDate(new Map());
      return;
    }

    setLeaveLoading(true);
    try {
      const res = await fetch(
        `/api/salary-slips/employee-period-days?period=${encodeURIComponent(periodLabel)}&employeeId=${encodeURIComponent(employeeId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setLeaveByDate(new Map());
        return;
      }
      const days = Array.isArray(data.leaveDays)
        ? (data.leaveDays as EmployeeLeaveDayInfo[])
        : [];
      setLeaveByDate(employeeLeaveDaysMap(days));
    } catch {
      setLeaveByDate(new Map());
    } finally {
      setLeaveLoading(false);
    }
  }, [periodLabel, employeeId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadLeaveDays();
  }, [loadLeaveDays]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Holidays may have been changed on the Admin page meanwhile.
    if (next) void loadConfig();
    else setError(null);
  };

  if (!periodLabel) return null;

  const savedCount = holidayDates.size;
  const leaveCount = leaveByDate.size;

  return (
    <>
      <Button
        type="button"
        variant="council-outline"
        className="h-11 w-full rounded-xl sm:w-auto"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        <CalendarDays className="h-4 w-4" />
        <span>Holidays</span>
        {(savedCount > 0 || leaveCount > 0) && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
            {savedCount > 0 && `${savedCount} hol`}
            {savedCount > 0 && leaveCount > 0 && " · "}
            {leaveCount > 0 && `${leaveCount} leave`}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden border-slate-200 p-0 sm:rounded-2xl"
          overlayClassName="bg-slate-900/50"
        >
          <DialogHeader className="border-b border-slate-200/80 px-5 py-4 text-left sm:px-6">
            <DialogTitle className="text-base font-black tracking-tight text-slate-900">
              {periodRange}
            </DialogTitle>
            {employeeName && (
              <p className="mt-1 text-sm text-slate-500">{employeeName}</p>
            )}
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200/80 bg-slate-50/80 px-5 py-2.5 text-[11px] text-slate-600 sm:px-6">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              Weekend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
              Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              Holiday
            </span>
            <span className="text-slate-400">Public holidays come from the Holiday Calendar on the Admin page</span>
          </div>

          <div className="max-h-[min(52vh,440px)] overflow-y-auto px-5 py-4 sm:px-6">
            {loading || leaveLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="space-y-6">
                {monthGroups.map((group) => {
                  const weekRows = buildWeekRows(group.items);
                  return (
                    <div key={`${group.year}-${group.month0}`}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        {ENGLISH_MONTHS[group.month0]} {group.year}
                      </p>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEK_HEADERS.map((label) => (
                          <div
                            key={label}
                            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
                          >
                            {label}
                          </div>
                        ))}
                        {weekRows.flat().map((d, idx) => {
                          if (!d) {
                            return (
                              <div
                                key={`empty-${group.year}-${group.month0}-${idx}`}
                                className="h-11"
                                aria-hidden
                              />
                            );
                          }

                          const isWeekend = isWeekendWeekday(d.weekday);
                          const leaveInfo = leaveByDate.get(d.iso);
                          const isHoliday =
                            !leaveInfo && holidayDates.has(d.iso);

                          const title = leaveInfo
                            ? `${leaveInfo.leaveLabel} — ${formatLeaveUsageCompact(leaveInfo.usage)}`
                            : isHoliday
                              ? "Public holiday"
                              : isWeekend
                                ? "Weekend"
                                : undefined;

                          return (
                            <div
                              key={d.iso}
                              title={title}
                              className={cn(
                                "flex h-11 flex-col items-center justify-center rounded-lg border text-center",
                                isWeekend
                                  ? "border-transparent bg-slate-100/80 text-slate-400"
                                  : leaveInfo
                                    ? "border-violet-200 bg-violet-50 text-violet-900"
                                    : isHoliday
                                      ? "border-rose-300 bg-rose-50 text-rose-900"
                                      : "border-slate-200/80 bg-white text-slate-800",
                              )}
                            >
                              <span className="text-sm font-bold leading-none">
                                {d.day}
                              </span>
                              {leaveInfo && (
                                <span className="mt-0.5 line-clamp-1 text-[9px] font-semibold leading-tight text-violet-700">
                                  {shortLeaveLabel(leaveInfo.leaveLabel)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-slate-200/80 bg-white px-5 py-3 sm:px-6">
            <Button asChild variant="ghost" className="rounded-xl text-teal-700">
              <Link href="/admin">
                Edit holidays <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              variant="council-outline"
              className="rounded-xl"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
