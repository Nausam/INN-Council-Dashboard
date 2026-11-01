import { graceMinutesForDesignation } from "@/lib/attendance-sync/employee-sync";
import { localTimeToMinutes } from "@/lib/attendance-sync/time";
import {
  MAX_LATENESS_MINUTES,
  MAX_PRAYER_DISTANCE_MINUTES,
  type MosquePrayer,
  type PrayerTimesByKey,
} from "@/lib/attendance-sync/types";

export type ClassifiedPunch = {
  prayer: MosquePrayer;
  timestampUtc: string;
  localMinutes: number;
  distanceMinutes: number;
};

const PRAYER_ORDER: Array<{ key: keyof PrayerTimesByKey; field: MosquePrayer }> = [
  { key: "fathisTime", field: "fathisSignInTime" },
  { key: "mendhuruTime", field: "mendhuruSignInTime" },
  { key: "asuruTime", field: "asuruSignInTime" },
  { key: "maqribTime", field: "maqribSignInTime" },
  { key: "ishaTime", field: "ishaSignInTime" },
];

function circularDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 * 60 - diff);
}

function midpointMinutes(before: number, after: number): number {
  if (after >= before) return Math.floor((before + after) / 2);
  return Math.floor(((before + after + 24 * 60) / 2) % (24 * 60));
}

export function buildPrayerSchedule(
  prayerTimes: PrayerTimesByKey,
  previousDayIshaTime?: string | null,
): Array<{ prayer: MosquePrayer; scheduledMinutes: number; lowerBound: number; upperBound: number }> {
  const scheduled = PRAYER_ORDER.map(({ key, field }) => ({
    prayer: field,
    scheduledMinutes: localTimeToMinutes(prayerTimes[key]),
  }));

  const bounds: Array<{
    prayer: MosquePrayer;
    scheduledMinutes: number;
    lowerBound: number;
    upperBound: number;
  }> = [];

  for (let i = 0; i < scheduled.length; i += 1) {
    const current = scheduled[i]!;
    const prev = i === 0 ? null : scheduled[i - 1]!;
    const next = i === scheduled.length - 1 ? null : scheduled[i + 1]!;

    const lowerBound =
      i === 0
        ? previousDayIshaTime
          ? midpointMinutes(localTimeToMinutes(previousDayIshaTime), current.scheduledMinutes)
          : 0
        : midpointMinutes(prev!.scheduledMinutes, current.scheduledMinutes);

    const upperBound = next
      ? midpointMinutes(current.scheduledMinutes, next.scheduledMinutes)
      : 24 * 60;

    bounds.push({
      ...current,
      lowerBound,
      upperBound,
    });
  }

  return bounds;
}

function isWithinInterval(minute: number, lower: number, upper: number): boolean {
  if (lower <= upper) return minute >= lower && minute < upper;
  return minute >= lower || minute < upper;
}

export function classifyPunchMinute(
  localMinutes: number,
  prayerTimes: PrayerTimesByKey,
  previousDayIshaTime?: string | null,
): MosquePrayer | null {
  const schedule = buildPrayerSchedule(prayerTimes, previousDayIshaTime);

  for (const entry of schedule) {
    if (!isWithinInterval(localMinutes, entry.lowerBound, entry.upperBound)) {
      continue;
    }

    const distance = circularDistanceMinutes(localMinutes, entry.scheduledMinutes);
    if (distance > MAX_PRAYER_DISTANCE_MINUTES) return null;
    return entry.prayer;
  }

  return null;
}

export function classifyPunch(
  timestampUtc: string,
  localMinutes: number,
  prayerTimes: PrayerTimesByKey,
  previousDayIshaTime?: string | null,
): ClassifiedPunch | null {
  const prayer = classifyPunchMinute(localMinutes, prayerTimes, previousDayIshaTime);
  if (!prayer) return null;

  const schedule = buildPrayerSchedule(prayerTimes, previousDayIshaTime);
  const entry = schedule.find((row) => row.prayer === prayer);
  if (!entry) return null;

  return {
    prayer,
    timestampUtc,
    localMinutes,
    distanceMinutes: circularDistanceMinutes(localMinutes, entry.scheduledMinutes),
  };
}

export function calculateMinutesLate(
  prayerTime: string,
  actualLocalMinutes: number,
  designation?: string,
): number {
  const scheduled = localTimeToMinutes(prayerTime);
  const grace = graceMinutesForDesignation(designation);
  const expectedArrival = Math.max(0, scheduled - grace);
  const late = Math.max(0, Math.round(actualLocalMinutes - expectedArrival));
  return Math.min(MAX_LATENESS_MINUTES, late);
}

export type PunchCandidate = {
  punchLogId: string;
  source: "zkteco" | "etime";
  timestampUtc: string;
  localMinutes: number;
};

export function selectEarliestPunchForPrayer(
  candidates: PunchCandidate[],
): PunchCandidate | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => {
    const bestMs = new Date(best.timestampUtc).getTime();
    const currentMs = new Date(current.timestampUtc).getTime();
    if (currentMs < bestMs) return current;
    if (currentMs > bestMs) return best;
    if (current.source === "zkteco" && best.source !== "zkteco") return current;
    return best;
  });
}

/** A second punch this soon after the first is treated as a double tap. */
const CARRY_OVER_MIN_GAP_MINUTES = 20;

/**
 * Staff often sign in for the next prayer a little before the halfway point
 * between two prayers, so both punches land in the earlier prayer and the
 * next one looks missed. When a prayer has a later, separate punch and the
 * next prayer has none, that punch counts for the next prayer instead, as
 * long as it is within the usual distance of that prayer's time.
 */
export function carryOverSecondPunches(
  grouped: Map<MosquePrayer, PunchCandidate[]>,
  prayerTimes: PrayerTimesByKey,
): Map<MosquePrayer, PunchCandidate[]> {
  const result = new Map(grouped);
  for (let i = 0; i < PRAYER_ORDER.length - 1; i += 1) {
    const current = PRAYER_ORDER[i]!.field;
    const next = PRAYER_ORDER[i + 1]!;
    if ((result.get(next.field) ?? []).length > 0) continue;

    const candidates = result.get(current) ?? [];
    const first = selectEarliestPunchForPrayer(candidates);
    if (!first) continue;
    const nextMinutes = localTimeToMinutes(prayerTimes[next.key]);
    const firstMs = new Date(first.timestampUtc).getTime();
    const carried = candidates
      .filter((candidate) => new Date(candidate.timestampUtc).getTime() - firstMs >= CARRY_OVER_MIN_GAP_MINUTES * 60_000)
      .filter((candidate) => circularDistanceMinutes(candidate.localMinutes, nextMinutes) <= MAX_PRAYER_DISTANCE_MINUTES)
      .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())[0];
    if (!carried) continue;

    result.set(current, candidates.filter((candidate) => candidate !== carried));
    result.set(next.field, [carried]);
  }
  return result;
}

export function groupCandidatesByPrayer(
  punches: Array<{
    punchLogId: string;
    source: "zkteco" | "etime";
    timestampUtc: string;
    localMinutes: number;
    prayer: MosquePrayer | null;
  }>,
): Map<MosquePrayer, PunchCandidate[]> {
  const grouped = new Map<MosquePrayer, PunchCandidate[]>();

  for (const punch of punches) {
    if (!punch.prayer) continue;
    const list = grouped.get(punch.prayer) ?? [];
    list.push({
      punchLogId: punch.punchLogId,
      source: punch.source,
      timestampUtc: punch.timestampUtc,
      localMinutes: punch.localMinutes,
    });
    grouped.set(punch.prayer, list);
  }

  return grouped;
}
