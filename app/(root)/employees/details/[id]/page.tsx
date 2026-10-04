export const dynamic = "force-dynamic";

import {
  fetchAttendanceForEmployeeMonth,
  fetchEmployeeById,
  fetchEmployeeLeaveCalendar,
  fetchMosqueDailyAttendanceForMonth,
} from "@/lib/firebase/hr";
import { requireEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import { EmployeeDetailsDashboardView } from "./EmployeeDetailsDashboardView";

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}

export default async function EmployeeDetailsDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { month?: string; tab?: string };
}) {
  await requireEmployeeProfileAccess(params.id);
  const month = monthFromSearchParam(searchParams?.month);
  const requestedTab = searchParams?.tab;
  const initialTab: "overview" | "attendance" | "leave" | "pay" | "requests" =
    requestedTab === "attendance" ||
    requestedTab === "leave" ||
    requestedTab === "pay" ||
    requestedTab === "requests"
      ? requestedTab
      : "overview";
  // Last month's records complete "Last week" early in a month.
  const lastMonth = previousMonth(month);
  const [employee, leaves, councilAttendance, mosqueAttendance, lastMonthCouncil, lastMonthMosque] =
    await Promise.all([
      fetchEmployeeById(params.id).catch(() => null),
      fetchEmployeeLeaveCalendar(params.id),
      fetchAttendanceForEmployeeMonth(month, params.id),
      fetchMosqueDailyAttendanceForMonth(month, params.id),
      fetchAttendanceForEmployeeMonth(lastMonth, params.id).catch(() => []),
      fetchMosqueDailyAttendanceForMonth(lastMonth, params.id).catch(() => []),
    ]);

  return (
    <EmployeeDetailsDashboardView
      employee={employee}
      leaves={leaves}
      councilAttendance={councilAttendance}
      mosqueAttendance={mosqueAttendance}
      recentCouncilAttendance={[...lastMonthCouncil, ...councilAttendance]}
      recentMosqueAttendance={[...lastMonthMosque, ...mosqueAttendance]}
      initialTab={initialTab}
    />
  );
}
