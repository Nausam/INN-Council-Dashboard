export type MosquePrayerTimes = {
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

export type PrefilledMosqueSignInTimes = {
  fathisSignInTime: string;
  mendhuruSignInTime: string;
  asuruSignInTime: string;
  maqribSignInTime: string;
  ishaSignInTime: string;
};

function subtractMinutes(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(":").map(Number);
  const totalMinutes = hours * 60 + mins - minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

function timeToDateTime(timeStr: string, dateStr: string): string {
  return `${dateStr}T${timeStr}:00.000+00:00`;
}

export function getPrefilledMosqueSignInTimes(
  designation: string,
  prayerTimes: MosquePrayerTimes,
  date: string,
): PrefilledMosqueSignInTimes {
  const graceMinutes = designation === "Imam" ? 5 : 15;

  return {
    fathisSignInTime: timeToDateTime(
      subtractMinutes(prayerTimes.fathisTime, graceMinutes),
      date,
    ),
    mendhuruSignInTime: timeToDateTime(
      subtractMinutes(prayerTimes.mendhuruTime, graceMinutes),
      date,
    ),
    asuruSignInTime: timeToDateTime(
      subtractMinutes(prayerTimes.asuruTime, graceMinutes),
      date,
    ),
    maqribSignInTime: timeToDateTime(
      subtractMinutes(prayerTimes.maqribTime, graceMinutes),
      date,
    ),
    ishaSignInTime: timeToDateTime(
      subtractMinutes(prayerTimes.ishaTime, graceMinutes),
      date,
    ),
  };
}
