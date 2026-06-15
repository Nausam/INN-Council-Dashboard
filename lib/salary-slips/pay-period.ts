import { format, parse } from "date-fns";

export type PayPeriodBounds = {
  startIso: string;
  endIso: string;
};

export type PayPeriodDateEntry = {
  iso: string;
  day: number;
  weekday: number;
  month0: number;
  year: number;
};

export type PayPeriodMonthGroup = {
  year: number;
  month0: number;
  items: PayPeriodDateEntry[];
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export function getWeekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "";
}

function parseDateOnly(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Pay period for periodLabel `YYYY-MM`: previous month 16 → selected month 15.
 * Example: `2026-06` → 16 May 2026 – 15 Jun 2026.
 */
export function getPayPeriodBounds(periodLabel: string): PayPeriodBounds | null {
  const m = periodLabel.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;

  const endYear = parseInt(m[1], 10);
  const endMonth = parseInt(m[2], 10);
  if (endMonth < 1 || endMonth > 12) return null;

  const endIso = `${endYear}-${String(endMonth).padStart(2, "0")}-15`;

  let startYear = endYear;
  let startMonth = endMonth - 1;
  if (startMonth === 0) {
    startMonth = 12;
    startYear -= 1;
  }
  const startIso = `${startYear}-${String(startMonth).padStart(2, "0")}-16`;

  return { startIso, endIso };
}

export function listPayPeriodDateEntries(periodLabel: string): PayPeriodDateEntry[] {
  const bounds = getPayPeriodBounds(periodLabel);
  if (!bounds) return [];

  const start = parseDateOnly(bounds.startIso);
  const end = parseDateOnly(bounds.endIso);
  if (!start || !end) return [];

  const entries: PayPeriodDateEntry[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    entries.push({
      iso: formatIsoLocal(cursor),
      day: cursor.getDate(),
      weekday: cursor.getDay(),
      month0: cursor.getMonth(),
      year: cursor.getFullYear(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return entries;
}

export function groupPayPeriodDatesByMonth(
  entries: PayPeriodDateEntry[],
): PayPeriodMonthGroup[] {
  const groups = new Map<string, PayPeriodMonthGroup>();

  for (const entry of entries) {
    const key = `${entry.year}-${entry.month0}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(entry);
    } else {
      groups.set(key, {
        year: entry.year,
        month0: entry.month0,
        items: [entry],
      });
    }
  }

  return Array.from(groups.values());
}

export function isWeekendWeekday(weekday: number): boolean {
  return weekday === 5 || weekday === 6;
}

/** Resolve calendar date for an attendance row (sheet date, else sign-in ISO date). */
export function resolveAttendanceRowDate(row: {
  date?: string;
  signInTime?: string | null;
}): string {
  const explicit = (row.date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;

  if (row.signInTime) {
    const match = row.signInTime.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  return "";
}

export function countAttendanceBenefitEligibleDaysInPeriod(
  periodLabel: string,
  holidayDates: ReadonlySet<string> = new Set(),
): number {
  return listPayPeriodDateEntries(periodLabel).filter((entry) =>
    isAttendanceBenefitEligibleDay(entry.iso, holidayDates),
  ).length;
}

export function isAttendanceBenefitEligibleDay(
  dateIso: string,
  holidayDates: ReadonlySet<string>,
): boolean {
  const date = parseDateOnly(dateIso);
  if (!date) return false;
  if (isWeekendWeekday(date.getDay())) return false;
  if (holidayDates.has(dateIso)) return false;
  return true;
}

/** Any non-empty leave type on the attendance record. */
export function isOnAttendanceLeave(
  leaveType: string | null | undefined,
): boolean {
  return (leaveType ?? "").trim().length > 0;
}

/** Whether a signed-in day qualifies for attendance benefit. */
export function qualifiesForAttendanceBenefit(
  signInTime: string | null | undefined,
  leaveType: string | null | undefined,
  dateIso: string,
  holidayDates: ReadonlySet<string>,
): boolean {
  if (isOnAttendanceLeave(leaveType)) return false;
  if (!signInTime) return false;
  const date = dateIso.trim();
  if (!date) return false;
  return isAttendanceBenefitEligibleDay(date, holidayDates);
}

export function sanitizeHolidayDates(
  periodLabel: string,
  dates: string[],
): string[] {
  const bounds = getPayPeriodBounds(periodLabel);
  if (!bounds) return [];

  const unique = new Set<string>();
  for (const raw of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue;
    if (raw < bounds.startIso || raw > bounds.endIso) continue;
    const date = parseDateOnly(raw);
    if (!date || isWeekendWeekday(date.getDay())) continue;
    unique.add(raw);
  }

  return Array.from(unique).sort();
}

export function formatPayPeriodRange(periodLabel: string): string {
  const bounds = getPayPeriodBounds(periodLabel);
  if (!bounds) return periodLabel;

  const start = parse(bounds.startIso, "yyyy-MM-dd", new Date());
  const end = parse(bounds.endIso, "yyyy-MM-dd", new Date());
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

export function parsePayPeriodBoundsAsDates(
  periodLabel: string,
): { start: Date; end: Date } | null {
  const bounds = getPayPeriodBounds(periodLabel);
  if (!bounds) return null;
  const start = parseDateOnly(bounds.startIso);
  const end = parseDateOnly(bounds.endIso);
  if (!start || !end) return null;
  return { start, end };
}
