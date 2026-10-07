const MV_OFFSET_MIN = 5 * 60;

/** Everyone is expected to sign in by 08:30 MVT; 08:31 counts as 1 minute late. */
export const REQUIRED_SIGN_IN_TIME = "08:30";

/** Section from employee record, with designation fallback (e.g. WDC President → WDC). */
export function resolveSectionForLateness(
  section?: string,
  designation?: string,
): string | undefined {
  const trimmed = (section ?? "").trim();
  if (trimmed) return trimmed;

  const des = (designation ?? "").toLowerCase();
  if (des.includes("wdc")) return "WDC";
  if (
    des.includes("councillor") ||
    des.includes("councilor") ||
    des.includes("council member")
  ) {
    return "Councillor";
  }

  return section;
}

function mvLocalToUtcDate(date: string, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map((value) => parseInt(value, 10));
  const utc = new Date(`${date}T00:00:00.000Z`);
  const mvMinutes = hh * 60 + mm;
  const utcMinutes = mvMinutes - MV_OFFSET_MIN;
  utc.setUTCMinutes(utcMinutes);
  return utc;
}

export function computeCouncilMinutesLate(
  signInTime: string,
  date: string,
): number {
  const requiredTime = mvLocalToUtcDate(date, REQUIRED_SIGN_IN_TIME);
  const actual = new Date(signInTime);
  return Math.max(
    0,
    Math.round((actual.getTime() - requiredTime.getTime()) / 60000),
  );
}
