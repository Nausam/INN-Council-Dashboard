export type InnamaadhooTimes = {
  island: { atoll: string; island: string; tz: string; offsetMinutes: number };
  date: string;
  times: {
    fathisTime: string;
    sunrise: string;
    mendhuruTime: string;
    asuruTime: string;
    maqribTime: string;
    ishaTime: string;
  };
};

export async function fetchInnamaadhooTimes(
  dateISO: string
): Promise<InnamaadhooTimes> {
  const res = await fetch(
    `/api/innamaadhoo?date=${encodeURIComponent(dateISO)}`,
    {
      method: "GET",
      headers: { accept: "application/json" },
    }
  );
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg += body?.error ? ` - ${body.error}` : "";
    } catch {
      // ignore parse errors
    }
    throw new Error(`salat API failed: ${msg}`);
  }
  return res.json();
}
