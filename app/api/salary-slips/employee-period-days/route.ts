import { fetchEmployeeById, fetchAttendanceForEmployeeRange } from "@/lib/firebase/hr";
import { hasEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { buildEmployeeLeaveDays } from "@/lib/salary-slips/employee-leave-days";
import { formatPayPeriodRange, getPayPeriodBounds } from "@/lib/salary-slips/pay-period";
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

  if (!(await hasEmployeeProfileAccess(employeeId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only this employee's rows, not the whole council's for the period.
    const bounds = getPayPeriodBounds(period)!;
    const dayAfterEnd = new Date(Date.parse(`${bounds.endIso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const [employee, attendance] = await Promise.all([
      fetchEmployeeById(employeeId),
      fetchAttendanceForEmployeeRange(employeeId, bounds.startIso, dayAfterEnd),
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
