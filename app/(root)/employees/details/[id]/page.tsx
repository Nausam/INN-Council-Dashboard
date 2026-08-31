export const dynamic = "force-dynamic";

import {
  fetchAttendanceForEmployeeMonth,
  fetchEmployeeById,
  fetchEmployeeLeaveCalendar,
  fetchMosqueDailyAttendanceForMonth,
} from "@/lib/firebase/hr";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import { EmployeeDetailsDashboardView } from "./EmployeeDetailsDashboardView";

export default async function EmployeeDetailsDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { month?: string };
}) {
  const month = monthFromSearchParam(searchParams?.month);
  const [employee, leaves, councilAttendance, mosqueAttendance] =
    await Promise.all([
      fetchEmployeeById(params.id).catch(() => null),
      fetchEmployeeLeaveCalendar(params.id),
      fetchAttendanceForEmployeeMonth(month, params.id),
      fetchMosqueDailyAttendanceForMonth(month, params.id),
    ]);

  return (
    <EmployeeDetailsDashboardView
      employee={employee}
      leaves={leaves}
      councilAttendance={councilAttendance}
      mosqueAttendance={mosqueAttendance}
    />
  );
}
