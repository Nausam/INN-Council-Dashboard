import {
  computeSalarySlipsForPeriod,
  paysPrayerAttendanceBenefit,
  type SalarySlipComputed,
} from "@/lib/salary-slips/compute-slip";
import {
  fetchAllEmployees,
  fetchAttendanceForPayPeriod,
  fetchEmployeeById,
  fetchMosqueAttendanceForEmployeeRange,
  fetchMosqueAttendanceForPeriod,
  fetchPayPeriodHolidayDates,
} from "@/lib/firebase/hr";
import type { EmployeeDoc, MosqueAttendanceDoc } from "@/lib/firebase/types";
import {
  formatPayPeriodRange,
  getPayPeriodBounds,
} from "@/lib/salary-slips/pay-period";
import { hasEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { NextRequest, NextResponse } from "next/server";

function dayAfterIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Mosque attendance for the pay period, read only when someone on the slip
 * is paid the attendance benefit per prayer.
 */
async function fetchPrayerBenefitAttendance(
  employees: EmployeeDoc[],
  periodLabel: string,
): Promise<MosqueAttendanceDoc[]> {
  const bounds = getPayPeriodBounds(periodLabel);
  const perPrayer = employees.filter(paysPrayerAttendanceBenefit);
  if (!bounds || perPrayer.length === 0) return [];
  if (employees.length === 1) {
    return fetchMosqueAttendanceForEmployeeRange(
      perPrayer[0].$id,
      bounds.startIso,
      dayAfterIso(bounds.endIso),
    );
  }
  return fetchMosqueAttendanceForPeriod(bounds.startIso, bounds.endIso);
}

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

  const authorized = employeeId
    ? await hasEmployeeProfileAccess(employeeId)
    : Boolean(await getSessionAuthProfile());
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [employees, attendance, holidayDates] = await Promise.all([
      employeeId ? fetchEmployeeById(employeeId).then((employee) => [employee]) : fetchAllEmployees(),
      fetchAttendanceForPayPeriod(trimmed),
      fetchPayPeriodHolidayDates(trimmed),
    ]);
    const mosqueAttendance = await fetchPrayerBenefitAttendance(employees, trimmed);

    const slips: SalarySlipComputed[] = computeSalarySlipsForPeriod(
      employees,
      trimmed,
      attendance,
      holidayDates,
      mosqueAttendance,
    );

    if (employeeId && slips.length === 0) {
      return NextResponse.json(
        { error: "Employee not found for this period" },
        { status: 404 },
      );
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
