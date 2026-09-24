import { convertTimeToDateTime } from "@/constants";

import { MALDIVES_TIMEZONE } from "@/lib/attendance-sync/types";

/** Node ICU may not accept Asia/Maldives; Indian/Maldives is the same offset. */
const MALDIVES_IANA = "Indian/Maldives";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MALDIVES_IANA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MALDIVES_IANA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function assertIsoDate(value: string, label = "date"): void {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export function utcToMaldivesParts(iso: string): {
  localDate: string;
  localTime: string;
  localMinutes: number;
  timezone: typeof MALDIVES_TIMEZONE;
} {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }

  const localDate = dateFormatter.format(date);
  const timeParts = timeFormatter.formatToParts(date);
  const hour = Number(timeParts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(timeParts.find((p) => p.type === "minute")?.value ?? "0");
  const localTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return {
    localDate,
    localTime,
    localMinutes: hour * 60 + minute,
    timezone: MALDIVES_TIMEZONE,
  };
}

export function localTimeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToLocalTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** UI/storage format: UTC hours mirror Maldives wall clock (legacy convention). */
export function punchUtcToAttendanceIso(
  timestampUtc: string,
  attendanceDate: string,
): string | null {
  const { localTime } = utcToMaldivesParts(timestampUtc);
  return convertTimeToDateTime(localTime, attendanceDate);
}

export function todayMaldivesIso(now = new Date()): string {
  return dateFormatter.format(now);
}

export function addDaysIso(date: string, days: number): string {
  assertIsoDate(date);
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function enumerateIsoDates(from: string, to: string): string[] {
  assertIsoDate(from);
  assertIsoDate(to);
  if (from > to) throw new Error("From date must be before to date.");

  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

/** Include the previous calendar month when recovering mosque attendance. */
export function mosqueRecoveryStartDate(today: string): string {
  assertIsoDate(today);
  return `${addDaysIso(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
}

export function maldivesMinutesNow(now = new Date()): number {
  const parts = utcToMaldivesParts(now.toISOString());
  return parts.localMinutes;
}

export function isPastDailyCreationTime(now = new Date()): boolean {
  return maldivesMinutesNow(now) >= 5;
}

export function isPastDailyReconcileTime(now = new Date()): boolean {
  return maldivesMinutesNow(now) >= 15;
}
