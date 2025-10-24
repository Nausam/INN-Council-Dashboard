// app/api/innamaadhoo/route.ts
import { getDb } from "@/lib/db";
import { dayIndexFromISO, InnamaadhooTimes } from "@/lib/salat";
import { NextResponse } from "next/server";

const ATOLL = "ރ";
const ISLAND = "އިންނަމާދޫ";
const TZ = "Indian/Maldives";

// --- NEW: row types from SQLite
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
function fmtHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad(h)}:${pad(m)}`;
}

// Robust island resolver with explicit typing
function getIslandRow(db: ReturnType<typeof getDb>): IslandRow | null {
  const exact = db
    .prepare(
      `
      SELECT "Atoll","Island","CategoryId","Minutes"
      FROM "Island"
      WHERE UPPER(TRIM("Atoll")) = UPPER(?) 
        AND UPPER(TRIM("Island")) = UPPER(?)
      LIMIT 1
    `
    )
    .get(ATOLL, ISLAND) as IslandRow | undefined;

  if (exact) return exact;

  const like = db
    .prepare(
      `
      SELECT "Atoll","Island","CategoryId","Minutes"
      FROM "Island"
      WHERE UPPER(TRIM("Atoll")) = UPPER(?)
        AND UPPER("Island") LIKE UPPER(?)
      ORDER BY "Island" ASC
      LIMIT 1
    `
    )
    .get(ATOLL, `${ISLAND}%`) as IslandRow | undefined;

  return like ?? null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateISO =
      searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const db = getDb();

    const island = getIslandRow(db);
    if (!island) {
      return NextResponse.json(
        { error: `Island row not found for ${ISLAND}` },
        { status: 404 }
      );
    }

    const dayIdx = dayIndexFromISO(dateISO);

    const row = db
      .prepare(
        `
        SELECT "Fajuru","Sunrise","Dhuhr","Asr","Maghrib","Isha"
        FROM "PrayerTimes"
        WHERE "CategoryId" = ? AND "Date" = ?
      `
      )
      .get(island.CategoryId, dayIdx) as TimesRow | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Prayer times not found for date" },
        { status: 404 }
      );
    }

    const adj = Number(island.Minutes) || 0;

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
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
