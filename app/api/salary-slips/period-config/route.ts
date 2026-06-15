import {
  fetchSalaryPeriodConfig,
  upsertSalaryPeriodConfig,
} from "@/lib/firebase/hr";
import { formatPayPeriodRange } from "@/lib/salary-slips/pay-period";
import { NextRequest, NextResponse } from "next/server";

function parsePeriod(period: string | null): string | null {
  const trimmed = typeof period === "string" ? period.trim() : "";
  if (!trimmed || !/^\d{4}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-06)" },
      { status: 400 },
    );
  }

  try {
    const config = await fetchSalaryPeriodConfig(period);
    return NextResponse.json({
      periodLabel: period,
      periodRange: formatPayPeriodRange(period),
      holidayDates: config?.holidayDates ?? [],
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

export async function PUT(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-06)" },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as { holidayDates?: unknown };
    const raw = Array.isArray(body.holidayDates) ? body.holidayDates : [];
    const holidayDates = raw.filter(
      (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );

    const config = await upsertSalaryPeriodConfig(period, holidayDates);

    return NextResponse.json({
      periodLabel: period,
      periodRange: formatPayPeriodRange(period),
      holidayDates: config.holidayDates,
    });
  } catch (error) {
    console.error("PUT /api/salary-slips/period-config error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save period configuration",
      },
      { status: 500 },
    );
  }
}
