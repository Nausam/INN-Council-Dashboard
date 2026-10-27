import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { fetchHolidayCalendar, upsertHolidayCalendar } from "@/lib/firebase/hr";
import { adjustLeaveForHolidays, type HolidayLeaveAdjustment } from "@/lib/leave/holiday-adjustments";

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
    // Leave already asked for or approved in this month is re-counted against
    // the new holidays. The holidays stay saved even if this fails; saving
    // again retries it.
    let adjustments: HolidayLeaveAdjustment[] = [];
    let adjustmentError: string | undefined;
    try {
      adjustments = await adjustLeaveForHolidays(config.month);
    } catch (error) {
      console.error("Adjusting leave for holidays failed:", error);
      adjustmentError = error instanceof Error ? error.message : "Could not re-count leave";
    }
    return NextResponse.json({
      month: config.month,
      holidayDates: config.holidayDates,
      adjustments,
      adjustmentError,
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
