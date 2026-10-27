import { fetchPayPeriodHolidayDates } from "@/lib/firebase/hr";
import { formatPayPeriodRange } from "@/lib/salary-slips/pay-period";
import { NextRequest, NextResponse } from "next/server";

function parsePeriod(period: string | null): string | null {
  const trimmed = typeof period === "string" ? period.trim() : "";
  if (!trimmed || !/^\d{4}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * The pay period's public holidays. They are marked in the Holiday Calendar
 * on the Admin page; salary slips only read them.
 */
export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-06)" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      periodLabel: period,
      periodRange: formatPayPeriodRange(period),
      holidayDates: await fetchPayPeriodHolidayDates(period),
    });
  } catch (error) {
    console.error("GET /api/salary-slips/period-config error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load period configuration",
      },
      { status: 500 },
    );
  }
}
