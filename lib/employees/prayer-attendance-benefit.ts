import type { EmployeeDoc, MosqueAttendanceDoc } from "@/lib/firebase/types";

/**
 * Mosque staff get their attendance benefit per prayer instead of per day.
 * Each prayer has its own MVR rate on the employee record; Friday's Mendhuru
 * is Hukuru, which has its own rate.
 */
export const PRAYER_ATTENDANCE_BENEFIT_FIELDS = [
  { key: "fathisAttendanceBenefit", prayer: "Fathis" },
  { key: "mendhuruAttendanceBenefit", prayer: "Mendhuru" },
  { key: "hukuruAttendanceBenefit", prayer: "Hukuru (Friday)" },
  { key: "asuruAttendanceBenefit", prayer: "Asuru" },
  { key: "maqribAttendanceBenefit", prayer: "Maqrib" },
  { key: "ishaAttendanceBenefit", prayer: "Isha" },
] as const;

export type PrayerAttendanceBenefitKey =
  (typeof PRAYER_ATTENDANCE_BENEFIT_FIELDS)[number]["key"];

export const PRAYER_ATTENDANCE_BENEFIT_KEYS: PrayerAttendanceBenefitKey[] =
  PRAYER_ATTENDANCE_BENEFIT_FIELDS.map((field) => field.key);

export type PrayerAttendanceBenefitRates = Record<PrayerAttendanceBenefitKey, number>;

function rate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function prayerAttendanceBenefitRates(employee: EmployeeDoc): PrayerAttendanceBenefitRates {
  const rates = {} as PrayerAttendanceBenefitRates;
  for (const key of PRAYER_ATTENDANCE_BENEFIT_KEYS) rates[key] = rate(employee[key]);
  return rates;
}

export function hasPrayerAttendanceBenefit(rates: PrayerAttendanceBenefitRates): boolean {
  return PRAYER_ATTENDANCE_BENEFIT_KEYS.some((key) => rates[key] > 0);
}

function isFriday(dateIso: string): boolean {
  return new Date(`${dateIso}T12:00:00Z`).getUTCDay() === 5;
}

function isOnLeave(row: MosqueAttendanceDoc): boolean {
  return (row.leaveType ?? "").trim().length > 0;
}

function signedIn(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function signInCount(row: MosqueAttendanceDoc): number {
  return [
    row.fathisSignInTime,
    row.mendhuruSignInTime,
    row.asuruSignInTime,
    row.maqribSignInTime,
    row.ishaSignInTime,
  ].filter(signedIn).length;
}

/** One row per date: a leave row wins, otherwise the row with more sign-ins. */
function rowsByDate(rows: MosqueAttendanceDoc[]): MosqueAttendanceDoc[] {
  const byDate = new Map<string, MosqueAttendanceDoc>();
  for (const row of rows) {
    const date = (row.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const existing = byDate.get(date);
    if (
      !existing ||
      (!isOnLeave(existing) && (isOnLeave(row) || signInCount(row) > signInCount(existing)))
    ) {
      byDate.set(date, row);
    }
  }
  return Array.from(byDate.values());
}

/** A missed prayer counts as this many late minutes, as in the mosque reports. */
export const MISSED_PRAYER_MINUTES = 60;

export type MosqueLatenessResult = {
  /** Late minutes plus MISSED_PRAYER_MINUTES for each missed prayer. */
  minutes: number;
  missedPrayers: number;
  /** Prayers signed in for, on the same days. */
  attendedPrayers: number;
};

/**
 * Same rule as the mosque monthly late/absent report: a signed-in prayer adds
 * its late minutes, a missed one adds an hour, and leave days count nothing.
 * `rows` must already be limited to this employee and the dates to count.
 */
export function computeMosqueLateness(rows: MosqueAttendanceDoc[]): MosqueLatenessResult {
  let minutes = 0;
  let missedPrayers = 0;
  let attendedPrayers = 0;
  for (const row of rowsByDate(rows)) {
    if (isOnLeave(row)) continue;
    for (const [signIn, late] of [
      [row.fathisSignInTime, row.fathisMinutesLate],
      [row.mendhuruSignInTime, row.mendhuruMinutesLate],
      [row.asuruSignInTime, row.asuruMinutesLate],
      [row.maqribSignInTime, row.maqribMinutesLate],
      [row.ishaSignInTime, row.ishaMinutesLate],
    ] as const) {
      if (signedIn(signIn)) {
        minutes += typeof late === "number" && Number.isFinite(late) && late > 0 ? late : 0;
        attendedPrayers += 1;
      } else {
        minutes += MISSED_PRAYER_MINUTES;
        missedPrayers += 1;
      }
    }
  }
  return { minutes, missedPrayers, attendedPrayers };
}

export type PrayerAttendanceBenefitResult = {
  amount: number;
  /** Prayers that earned the benefit. */
  prayers: number;
};

/**
 * Same rule as the mosque monthly allowance report: every signed-in prayer
 * earns its rate, any day of the week, and leave days earn nothing.
 * `rows` must already be limited to this employee and the pay period.
 */
export function computePrayerAttendanceBenefit(
  rates: PrayerAttendanceBenefitRates,
  rows: MosqueAttendanceDoc[],
): PrayerAttendanceBenefitResult {
  let amount = 0;
  let prayers = 0;
  const add = (value: number) => {
    amount += value;
    prayers += 1;
  };

  for (const row of rowsByDate(rows)) {
    if (isOnLeave(row)) continue;
    if (signedIn(row.fathisSignInTime)) add(rates.fathisAttendanceBenefit);
    if (signedIn(row.mendhuruSignInTime)) {
      // Hukuru falls back to the Mendhuru rate when no Friday rate is set.
      add(
        isFriday(row.date.slice(0, 10)) && rates.hukuruAttendanceBenefit > 0
          ? rates.hukuruAttendanceBenefit
          : rates.mendhuruAttendanceBenefit,
      );
    }
    if (signedIn(row.asuruSignInTime)) add(rates.asuruAttendanceBenefit);
    if (signedIn(row.maqribSignInTime)) add(rates.maqribAttendanceBenefit);
    if (signedIn(row.ishaSignInTime)) add(rates.ishaAttendanceBenefit);
  }

  return { amount: Math.round(amount * 100) / 100, prayers };
}
