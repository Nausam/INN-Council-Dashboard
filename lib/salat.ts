// lib/salat.ts
import { getDb } from "./db";

/** Format minutes-from-midnight (+ optional adjust) to "HH:MM" */
function toHHMM(dayMinutes: number, adjust: number) {
  const total = dayMinutes + adjust;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Replicates the Flutter calc: diff.inDays - 1 (using UTC to be deterministic) */
function dayIndexFlutterStyle(d: Date) {
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1); // Jan 1 00:00 UTC
  const diffDays = Math.floor(
    (Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - start) / 86400000
  );
  return diffDays - 1;
}

/** Fetch **island** row for Innamaadhoo (so we can get CategoryId & Minutes) */
// lib/salat.ts

/** Fetch **island** row for Innamaadhoo (so we can get CategoryId & Minutes) */
function getInnamaadhooIsland() {
  const db = getDb();

  // Search for Innamaadhoo in Dhivehi: އިންނަމާދޫ
  // R. Innamaadhoo atoll code in Dhivehi is: ރ
  const result = db
    .prepare(
      `SELECT "Atoll","Island","IslandId","CategoryId","Minutes"
         FROM "Island"
        WHERE "Atoll" = 'ރ' AND "Island" = 'އިންނަމާދޫ'
        LIMIT 1`
    )
    .get() as
    | {
        Atoll: string;
        Island: string;
        IslandId: number;
        CategoryId: number;
        Minutes: number;
      }
    | undefined;

  // console.log("Innamaadhoo query result:", result);

  return result;
}

/** Fetch times for Innamaadhoo on a given YYYY-MM-DD (UTC) */
export function getInnamaadhooFor(dateISO: string) {
  const island = getInnamaadhooIsland();
  if (!island) throw new Error("Island row not found for Innamaadhoo");

  const dUTC = new Date(dateISO + "T00:00:00Z");
  if (Number.isNaN(dUTC.getTime()))
    throw new Error("Bad date format. Use YYYY-MM-DD");

  const dateIdx = dayIndexFlutterStyle(dUTC);

  const db = getDb();
  const row = db
    .prepare(
      `SELECT "Fajuru","Sunrise","Dhuhr","Asr","Maghrib","Isha"
         FROM "PrayerTimes"
        WHERE "CategoryId" = ? AND "Date" = ?`
    )
    .get(island.CategoryId, dateIdx) as
    | {
        Fajuru: number;
        Sunrise: number;
        Dhuhr: number;
        Asr: number;
        Maghrib: number;
        Isha: number;
      }
    | undefined;

  if (!row) {
    return null; // no row for that day index
  }

  const adj = island.Minutes ?? 0;

  return {
    island: {
      atoll: island.Atoll,
      island: island.Island,
      tz: "Indian/Maldives",
      offsetMinutes: adj,
    },
    date: dateISO,
    times: {
      fathisTime: toHHMM(row.Fajuru, adj),
      sunrise: toHHMM(row.Sunrise, adj),
      mendhuruTime: toHHMM(row.Dhuhr, adj),
      asuruTime: toHHMM(row.Asr, adj),
      maqribTime: toHHMM(row.Maghrib, adj),
      ishaTime: toHHMM(row.Isha, adj),
    },
  };
}

export type InnamaadhooTimes = {
  island: { atoll: string; island: string; tz: string; offsetMinutes: number };
  date: string; // YYYY-MM-DD
  times: {
    fathisTime: string;
    sunrise: string;
    mendhuruTime: string;
    asuruTime: string;
    maqribTime: string;
    ishaTime: string;
  };
};

/** Day index in DB = day-of-year - 1 (0..364/365) in **UTC** */
export function dayIndexFromISO(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const idx = Math.floor((d.getTime() - start) / 86400000) - 1;
  return idx;
}
