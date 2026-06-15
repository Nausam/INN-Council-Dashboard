import { fetchEmployeeById, fetchAttendanceForPayPeriod } from "@/lib/firebase/hr";
import { buildEmployeeLeaveDays } from "@/lib/salary-slips/employee-leave-days";
import { formatPayPeriodRange } from "@/lib/salary-slips/pay-period";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period")?.trim() ?? "";
  const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim() ?? "";

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-06)" },
      { status: 400 },
    );
  }

  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 },
    );
  }

  try {
    const [employee, attendance] = await Promise.all([
      fetchEmployeeById(employeeId),
      fetchAttendanceForPayPeriod(period),
    ]);

    const leaveDays = buildEmployeeLeaveDays(employee, attendance, period);

    return NextResponse.json({
      periodLabel: period,
      periodRange: formatPayPeriodRange(period),
      employeeId,
      employeeName: employee.name?.trim() ?? "",
      leaveDays,
    });
  } catch (error) {
    console.error("GET /api/salary-slips/employee-period-days error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load employee leave days",
      },
      { status: 500 },
    );
  }
}
