import { getInnamaadhooFor } from "@/lib/salat";
import type { PrayerSchedule } from "@/lib/employees/details-dashboard";

/**
 * Innamaadhoo prayer times for each date, read from the bundled salat
 * database on the server, so the mosque profile costs no Firestore reads.
 * Dates the database can't answer are left out and show without a schedule.
 */
export function loadPrayerSchedule(dates: string[]): PrayerSchedule {
  const schedule: PrayerSchedule = {};
  for (const date of dates) {
    try {
      const day = getInnamaadhooFor(date);
      if (!day) continue;
      schedule[date] = {
        fathis: day.times.fathisTime,
        mendhuru: day.times.mendhuruTime,
        asuru: day.times.asuruTime,
        maqrib: day.times.maqribTime,
        isha: day.times.ishaTime,
      };
    } catch (error) {
      console.error("Prayer times unavailable for the employee profile", error);
      break;
    }
  }
  return schedule;
}
