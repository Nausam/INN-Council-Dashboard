"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

function monthTitle(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTHS[(monthNumber || 1) - 1] ?? month} ${year || ""}`.trim();
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

  const calendarDays = useMemo(() => buildMonthDays(month), [month]);
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
      toast({
        title: "Holidays saved",
        description: `${dates.length} holiday${dates.length === 1 ? "" : "s"} saved for ${monthTitle(month)}.`,
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
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Holiday Calendar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Mark public holidays for attendance and continuous leave counting.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="council-outline"
              className="h-10 rounded-lg"
              onClick={reset}
              disabled={loading || saving || !isDirty}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              variant="council"
              className="h-10 rounded-lg"
              onClick={save}
              disabled={loading || saving || !isDirty}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">
          {holidayDates.size} marked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          Public holiday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Friday/Saturday
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5">
        <div className="mb-2 text-sm font-bold text-slate-900">
          {monthTitle(month)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
            >
              {weekday}
            </div>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) {
              return (
                <div key={`empty-${index}`} className="aspect-square" />
              );
            }

            const isWeekend = day.weekday === 5 || day.weekday === 6;
            const isHoliday = holidayDates.has(day.iso);

            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => toggleDate(day.iso)}
                disabled={loading || saving}
                className={cn(
                  "flex aspect-square min-h-14 flex-col items-start rounded-lg border p-2 text-left text-sm font-bold transition-colors",
                  isHoliday
                    ? "border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100"
                    : isWeekend
                      ? "border-slate-200 bg-slate-50 text-slate-500 hover:border-teal-300"
                      : "border-slate-200 bg-white text-slate-900 hover:border-teal-300 hover:bg-teal-50/50",
                )}
              >
                <span>{day.day}</span>
                {isHoliday && (
                  <span className="mt-auto max-w-full truncate rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                    Holiday
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
