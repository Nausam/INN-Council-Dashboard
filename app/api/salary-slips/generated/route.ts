import {
  computeSalarySlipsForPeriod,
  type SalarySlipComputed,
} from "@/lib/salary-slips/compute-slip";
import {
  fetchAllEmployees,
  fetchAttendanceForPayPeriod,
  fetchSalaryPeriodConfig,
} from "@/lib/firebase/hr";
import { formatPayPeriodRange } from "@/lib/salary-slips/pay-period";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  const trimmed = typeof period === "string" ? period.trim() : "";

  if (!trimmed || !/^\d{4}-\d{2}$/.test(trimmed)) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-05)" },
      { status: 400 },
    );
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim();

  try {
    const [employees, attendance, periodConfig] = await Promise.all([
      fetchAllEmployees(),
      fetchAttendanceForPayPeriod(trimmed),
      fetchSalaryPeriodConfig(trimmed),
    ]);

    const holidayDates = periodConfig?.holidayDates ?? [];

    let slips: SalarySlipComputed[] = computeSalarySlipsForPeriod(
      employees,
      trimmed,
      attendance,
      holidayDates,
    );

    if (employeeId) {
      slips = slips.filter((s) => s.employeeId === employeeId);
      if (slips.length === 0) {
        return NextResponse.json(
          { error: "Employee not found for this period" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({
      periodLabel: trimmed,
      periodRange: formatPayPeriodRange(trimmed),
      holidayDates,
      slips,
    });
  } catch (error) {
    console.error("GET /api/salary-slips/generated error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate salary slips",
      },
      { status: 500 },
    );
  }
}
