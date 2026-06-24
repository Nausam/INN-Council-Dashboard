import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { fetchHolidayCalendar, upsertHolidayCalendar } from "@/lib/firebase/hr";

export const runtime = "nodejs";

function monthFromRequest(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("month") ?? "";
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const month = monthFromRequest(request);
    const config = await fetchHolidayCalendar(month);
    return NextResponse.json({
      month,
      holidayDates: config?.holidayDates ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load holidays",
      },
      { status: adminErrorStatus(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const month = monthFromRequest(request);
    const body = (await request.json()) as { holidayDates?: unknown };
    const holidayDates = Array.isArray(body.holidayDates)
      ? body.holidayDates.filter(
          (date): date is string => typeof date === "string",
        )
      : [];

    const config = await upsertHolidayCalendar(month, holidayDates);
    return NextResponse.json({
      month: config.month,
      holidayDates: config.holidayDates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save holidays",
      },
      { status: adminErrorStatus(error) },
    );
  }
}
