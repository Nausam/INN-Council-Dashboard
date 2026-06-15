const MV_OFFSET_MIN = 5 * 60;

function normalizeSectionKey(section?: string): string {
  return (section ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function getRequiredSignInTime(section?: string): string {
  const key = normalizeSectionKey(section);
  if (
    ["councillor", "councilor", "council", "counciler", "wdc"].includes(key)
  ) {
    return "08:30";
  }
  return "08:00";
}

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
  section?: string,
): number {
  const requiredTime = mvLocalToUtcDate(date, getRequiredSignInTime(section));
  const actual = new Date(signInTime);
  return Math.max(
    0,
    Math.round((actual.getTime() - requiredTime.getTime()) / 60000),
  );
}
