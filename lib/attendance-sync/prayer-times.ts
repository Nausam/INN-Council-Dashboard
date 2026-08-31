import type { MosquePrayerTimes } from "@/lib/attendance/mosque-prefill";
import { fetchAllEmployees, fetchPrayerTimesByDate } from "@/lib/firebase/hr";
import { getInnamaadhooFor } from "@/lib/salat";
import type { PrayerTimesByKey } from "@/lib/attendance-sync/types";
import { addDaysIso } from "@/lib/attendance-sync/time";

export async function resolvePrayerTimesForDate(
  date: string,
): Promise<PrayerTimesByKey | null> {
  try {
    const salat = getInnamaadhooFor(date);
    if (salat?.times) {
      return {
        fathisTime: salat.times.fathisTime,
        mendhuruTime: salat.times.mendhuruTime,
        asuruTime: salat.times.asuruTime,
        maqribTime: salat.times.maqribTime,
        ishaTime: salat.times.ishaTime,
      };
    }
  } catch {
    /* fall through */
  }

  const fetched = await fetchPrayerTimesByDate(date);
  if (!fetched) return null;

  return {
    fathisTime: fetched.fathisTime,
    mendhuruTime: fetched.mendhuruTime,
    asuruTime: fetched.asuruTime,
    maqribTime: fetched.maqribTime,
    ishaTime: fetched.ishaTime,
  };
}

export function toMosquePrayerTimes(times: PrayerTimesByKey): MosquePrayerTimes {
  return { ...times };
}

export async function resolvePreviousDayIshaTime(date: string): Promise<string | null> {
  const previous = addDaysIso(date, -1);
  const times = await resolvePrayerTimesForDate(previous);
  return times?.ishaTime ?? null;
}
