"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Loader2, RotateCcw, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { HolidayLeaveAdjustment } from "@/lib/leave/holiday-adjustments";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
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

type CalendarDay = {
  iso: string;
  day: number;
  weekday: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function todayIso(): string {
  const now = new Date();
  return `${currentMonthKey()}-${pad(now.getDate())}`;
}

function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + by, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthTitle(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTHS[(monthNumber || 1) - 1] ?? month} ${year || ""}`.trim();
}

function holidayLabel(iso: string): { weekday: string; date: string } {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    date: date.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

function shortDates(dates: string[]): string {
  return dates.map((iso) => holidayLabel(iso).date).join(", ");
}

/** What a save changed for one leave request, in a line. */
function adjustmentLine(item: HolidayLeaveAdjustment): string {
  const parts: string[] = [];
  if (item.daysBefore !== undefined && item.daysAfter !== undefined) {
    parts.push(`${item.daysBefore} → ${item.daysAfter} days`);
  }
  if (item.removed.length) parts.push(`${shortDates(item.removed)} returned to balance`);
  if (item.added.length) parts.push(`${shortDates(item.added)} marked as leave`);
  if (item.problem) parts.push(item.problem);
  return parts.join(" · ");
}

function buildMonthDays(month: string): Array<CalendarDay | null> {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [];

  const first = new Date(year, monthNumber - 1, 1);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const cells: Array<CalendarDay | null> = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthNumber - 1, day);
    cells.push({
      iso: `${year}-${pad(monthNumber)}-${pad(day)}`,
      day,
      weekday: date.getDay(),
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function validHolidayDates(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter(
        (date): date is string =>
          typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
      )
    : [];
}

/**
 * The one place public holidays are marked. Attendance, leave approvals and
 * day counts, missing leave forms, reports and salary slips all read them.
 */
export function HolidayCalendarPanel() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [serverHolidayDates, setServerHolidayDates] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leave requests the last save re-counted, shown until the month changes.
  const [adjustments, setAdjustments] = useState<HolidayLeaveAdjustment[] | null>(null);

  const calendarDays = useMemo(() => buildMonthDays(month), [month]);
  const sortedHolidays = useMemo(() => Array.from(holidayDates).sort(), [holidayDates]);
  const today = todayIso();
  const isDirty = useMemo(() => {
    if (holidayDates.size !== serverHolidayDates.size) return true;
    for (const date of Array.from(holidayDates)) {
      if (!serverHolidayDates.has(date)) return true;
    }
    return false;
  }, [holidayDates, serverHolidayDates]);

  const loadHolidays = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/holidays?month=${encodeURIComponent(month)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load holidays");
      }
      const dates = validHolidayDates(data.holidayDates);
      setHolidayDates(new Set(dates));
      setServerHolidayDates(new Set(dates));
    } catch (caught) {
      setHolidayDates(new Set());
      setServerHolidayDates(new Set());
      setError(
        caught instanceof Error ? caught.message : "Failed to load holidays",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const goToMonth = (next: string) => {
    if (!next || next === month) return;
    if (isDirty && !window.confirm(`Discard the unsaved holidays for ${monthTitle(month)}?`)) return;
    setMonth(next);
    setAdjustments(null);
  };

  const toggleDate = (iso: string) => {
    setHolidayDates((previous) => {
      const next = new Set(previous);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const reset = () => {
    setHolidayDates(new Set(serverHolidayDates));
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/holidays?month=${encodeURIComponent(month)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holidayDates: Array.from(holidayDates).sort(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save holidays");
      }
      const dates = validHolidayDates(data.holidayDates);
      setHolidayDates(new Set(dates));
      setServerHolidayDates(new Set(dates));
      const changed: HolidayLeaveAdjustment[] = Array.isArray(data.adjustments) ? data.adjustments : [];
      setAdjustments(changed);
      if (data.adjustmentError) {
        setError(`Holidays saved, but leave couldn't be re-counted (${data.adjustmentError}). Save again to retry.`);
      }
      toast({
        title: "Holidays saved",
        description: `${dates.length} holiday${dates.length === 1 ? "" : "s"} saved for ${monthTitle(month)}.${
          changed.length ? ` ${changed.length} leave request${changed.length === 1 ? "" : "s"} re-counted.` : ""
        }`,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to save holidays",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-[#e4ece8] bg-white p-5 shadow-[0_12px_32px_rgba(34,49,50,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd2c2] to-[#e0734f] text-white shadow-[0_8px_16px_-10px_rgba(224,115,79,0.9)]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#1b302e]">Holiday Calendar</h2>
            <p className="text-xs font-medium text-[#84918e]">
              Public holidays for attendance, leave, missing forms and salary slips
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="council-outline"
            className="h-9 rounded-full px-3 text-xs"
            onClick={reset}
            disabled={loading || saving || !isDirty}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            variant="council"
            className="h-9 rounded-full px-4 text-xs"
            onClick={save}
            disabled={loading || saving || !isDirty}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Month */}
        <div className="w-full max-w-[360px] rounded-3xl border border-[#eef2ef] bg-[#fbfcfb] p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goToMonth(shiftMonth(month, -1))}
              disabled={saving}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#527668] hover:bg-white hover:shadow-sm disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative cursor-pointer text-sm font-black text-[#1b302e]">
              {monthTitle(month)}
              {loading ? <Loader2 className="ml-1.5 inline h-3.5 w-3.5 animate-spin text-[#84918e]" /> : null}
              <input
                type="month"
                value={month}
                onChange={(event) => goToMonth(event.target.value)}
                aria-label="Choose month"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={() => goToMonth(shiftMonth(month, 1))}
              disabled={saving}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#527668] hover:bg-white hover:shadow-sm disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={index}
                className={cn(
                  "pb-1 text-center text-[10px] font-black uppercase",
                  index >= 5 ? "text-[#c3c9c6]" : "text-[#93a29b]",
                )}
              >
                {weekday}
              </div>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} />;

              const isWeekend = day.weekday === 5 || day.weekday === 6;
              const isHoliday = holidayDates.has(day.iso);

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => toggleDate(day.iso)}
                  disabled={loading || saving}
                  aria-pressed={isHoliday}
                  aria-label={`${holidayLabel(day.iso).date}${isHoliday ? ", public holiday" : ""}`}
                  className={cn(
                    "mx-auto flex aspect-square w-full max-w-10 items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition",
                    isHoliday
                      ? "bg-gradient-to-br from-[#ffb59b] to-[#e0734f] text-white shadow-[0_6px_14px_-8px_rgba(224,115,79,0.95)]"
                      : isWeekend
                        ? "text-[#b9c2be] hover:bg-white"
                        : "text-[#344845] hover:bg-white hover:shadow-sm",
                    day.iso === today && !isHoliday && "ring-2 ring-[#8cc9b1]",
                  )}
                >
                  {day.day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-semibold text-[#84918e]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0734f]" />
              Public holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#dfe5e2]" />
              Fri / Sat
            </span>
          </div>
        </div>

        {/* This month's holidays */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-black text-[#1b302e]">{monthTitle(month)}</h3>
            <span className="text-xs font-bold text-[#84918e]">
              {sortedHolidays.length} {sortedHolidays.length === 1 ? "holiday" : "holidays"}
              {isDirty ? " · unsaved" : ""}
            </span>
          </div>
          {sortedHolidays.length ? (
            <ul className="flex flex-wrap gap-2">
              {sortedHolidays.map((iso) => {
                const label = holidayLabel(iso);
                return (
                  <li
                    key={iso}
                    className="flex items-center gap-2 rounded-full border border-[#ffe1d6] bg-[#fff6f2] py-1 pl-3 pr-1 text-xs font-bold text-[#a64b2f]"
                  >
                    <span className="text-[#d0846a]">{label.weekday}</span>
                    {label.date}
                    <button
                      type="button"
                      onClick={() => toggleDate(iso)}
                      disabled={loading || saving}
                      aria-label={`Remove ${label.date}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#c0573c] hover:bg-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#e4ece8] px-4 py-5 text-center text-xs font-medium text-[#93a29b]">
              No public holidays this month. Tap a day to mark one.
            </p>
          )}
          {adjustments ? (
            <div className="mt-4 rounded-2xl border border-[#d9ebe5] bg-[#f1faf6] p-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-[#167a67]">
                <CalendarCheck className="h-3.5 w-3.5" />
                {adjustments.length
                  ? `Leave re-counted for the new holidays`
                  : "No leave requests needed changing"}
              </p>
              {adjustments.length ? (
                <ul className="mt-2 space-y-1.5">
                  {adjustments.map((item, index) => (
                    <li key={index} className="text-xs text-[#3d5a55]">
                      <span className="font-bold text-[#1b302e]">{item.employeeName}</span>
                      {" · "}{item.kind} ({item.status.toLowerCase()})
                      <span className={cn("block", item.problem ? "text-rose-700" : "text-[#6b807b]")}>
                        {adjustmentLine(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <p className="mt-auto pt-4 text-[11px] leading-relaxed text-[#93a29b]">
            Council staff aren&rsquo;t expected at work on these days: leave and
            missing forms skip them, and the attendance benefit doesn&rsquo;t count them. Saving
            re-counts leave already requested or approved in the month. Mosque staff work every
            day, so their leave isn&rsquo;t affected.
          </p>
        </div>
      </div>
    </section>
  );
}
