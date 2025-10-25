// app/api/innamaadhoo/route.ts
import { getDb } from "@/lib/db";
import { dayIndexFromISO, InnamaadhooTimes } from "@/lib/salat";
import { NextResponse } from "next/server";

const ATOLL = "ރ";
const ISLAND = "އިންނަމާދޫ";
const TZ = "Indian/Maldives";

// --- row types in salat.db ---
type IslandRow = {
  Atoll: string;
  Island: string;
  CategoryId: number;
  Minutes: number;
};

type TimesRow = {
  Fajuru: number;
  Sunrise: number;
  Dhuhr: number;
  Asr: number;
  Maghrib: number;
  Isha: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Normalize minutes to 0..1439 then render HH:mm */
function fmtHHMM(total: number): string {
  const DAY = 24 * 60;
  const norm = ((total % DAY) + DAY) % DAY;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${pad(h)}:${pad(m)}`;
}

function isIsoDate(s: string): boolean {
  // yyyy-mm-dd (no time)
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Resolve Innamaadhoo row from Island table */
function getIslandRow(db: ReturnType<typeof getDb>): IslandRow | null {
  const exact = db
    .prepare<unknown[], IslandRow>(
      `
      SELECT "Atoll","Island","CategoryId","Minutes"
      FROM "Island"
      WHERE UPPER(TRIM("Atoll")) = UPPER(?)
        AND UPPER(TRIM("Island")) = UPPER(?)
      LIMIT 1
    `
    )
    .get(ATOLL, ISLAND);

  if (exact) return exact;

  const like = db
    .prepare<unknown[], IslandRow>(
      `
      SELECT "Atoll","Island","CategoryId","Minutes"
      FROM "Island"
      WHERE UPPER(TRIM("Atoll")) = UPPER(?)
        AND UPPER("Island") LIKE UPPER(?)
      ORDER BY "Island" ASC
      LIMIT 1
    `
    )
    .get(ATOLL, `${ISLAND}%`);

  return like ?? null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("date");
    const todayISO = new Date().toISOString().slice(0, 10);
    const dateISO = raw && isIsoDate(raw) ? raw : todayISO;

    const db = getDb(); // returns a better-sqlite3 Database

    const island = getIslandRow(db);
    if (!island) {
      return NextResponse.json(
        { error: `Island row not found for ${ISLAND}` },
        { status: 404 }
      );
    }

    const dayIdx = dayIndexFromISO(dateISO);

    const row = db
      .prepare<[number, number], TimesRow>(
        `
        SELECT "Fajuru","Sunrise","Dhuhr","Asr","Maghrib","Isha"
        FROM "PrayerTimes"
        WHERE "CategoryId" = ? AND "Date" = ?
      `
      )
      .get(island.CategoryId, dayIdx);

    if (!row) {
      return NextResponse.json(
        { error: "Prayer times not found for date" },
        { status: 404 }
      );
    }

    const adj = Number.isFinite(island.Minutes) ? island.Minutes : 0;

    const payload: InnamaadhooTimes = {
      island: {
        atoll: island.Atoll,
        island: island.Island,
        tz: TZ,
        offsetMinutes: adj,
      },
      date: dateISO,
      times: {
        fathisTime: fmtHHMM(row.Fajuru + adj),
        sunrise: fmtHHMM(row.Sunrise + adj),
        mendhuruTime: fmtHHMM(row.Dhuhr + adj),
        asuruTime: fmtHHMM(row.Asr + adj),
        maqribTime: fmtHHMM(row.Maghrib + adj),
        ishaTime: fmtHHMM(row.Isha + adj),
      },
    };

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
