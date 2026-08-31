import type { MosquePrayerTimes } from "@/lib/attendance/mosque-prefill";
import { getPrefilledMosqueSignInTimes } from "@/lib/attendance/mosque-prefill";
import type { MosqueAttendanceDoc } from "@/lib/firebase/types";
import type { MosquePrayer } from "@/lib/attendance-sync/types";

export function isLegacyPrefillPlaceholder(
  row: MosqueAttendanceDoc,
  prayer: MosquePrayer,
  prayerTimes: MosquePrayerTimes,
  designation: string,
): boolean {
  if (row.changed) return false;
  if (row.leaveType) return false;

  const prefilled = getPrefilledMosqueSignInTimes(designation, prayerTimes, row.date);
  const current = row[prayer];
  const expected = prefilled[prayer];
  return Boolean(current && expected && current === expected);
}

export function clearLegacyPrefillFields(
  row: MosqueAttendanceDoc,
  prayerTimes: MosquePrayerTimes,
  designation: string,
): Partial<MosqueAttendanceDoc> {
  const updates: Partial<MosqueAttendanceDoc> = {};
  const prayers: MosquePrayer[] = [
    "fathisSignInTime",
    "mendhuruSignInTime",
    "asuruSignInTime",
    "maqribSignInTime",
    "ishaSignInTime",
  ];

  for (const prayer of prayers) {
    if (!isLegacyPrefillPlaceholder(row, prayer, prayerTimes, designation)) continue;
    updates[prayer] = null;
    const lateKey = prayer.replace("SignInTime", "MinutesLate") as keyof MosqueAttendanceDoc;
    updates[lateKey] = 0 as never;
  }

  return updates;
}
