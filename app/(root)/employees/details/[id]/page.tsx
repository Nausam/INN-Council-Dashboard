export const dynamic = "force-dynamic";

import { Suspense } from "react";
import {
  fetchAttendanceForEmployeeRange,
  fetchEmployeeById,
  fetchEmployeeLeaveCalendar,
  fetchMosqueAttendanceForEmployeeRange,
  monthDateBounds,
} from "@/lib/firebase/hr";
import type { EmployeeDoc } from "@/lib/firebase/types";
import { getEmployeeProfileSessionId, requireEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import {
  isMosqueEmployee,
  lastWeekStartIso,
  maldivesTodayIso,
  mosqueProfileDates,
} from "@/lib/employees/details-dashboard";
import { loadPrayerSchedule } from "@/lib/employees/prayer-schedule";
import { graceMinutesForDesignation } from "@/lib/attendance-sync/employee-sync";
import { employeePhotoUrl } from "@/lib/employees/photo";
import {
  DetailsSkeleton,
  EmployeeDetailsDashboardView,
  type MosqueProfileData,
} from "./EmployeeDetailsDashboardView";

type TabId = "overview" | "attendance" | "leave" | "pay" | "requests";

/**
 * Leave plus attendance for `month`. One read per collection covers the month
 * and, early in a month, the days "Last week" needs from the month before.
 */
async function loadDashboardRecords(employeeId: string, month: string) {
  const { start: monthStart, endExclusive: monthEnd } = monthDateBounds(month);
  const lastWeekStart = lastWeekStartIso(maldivesTodayIso());
  const rangeStart = lastWeekStart < monthStart ? lastWeekStart : monthStart;
  const [leaves, council, mosque] = await Promise.all([
    fetchEmployeeLeaveCalendar(employeeId),
    fetchAttendanceForEmployeeRange(employeeId, rangeStart, monthEnd),
    fetchMosqueAttendanceForEmployeeRange(employeeId, rangeStart, monthEnd),
  ]);
  const inMonth = (row: { date: string }) => row.date >= monthStart && row.date < monthEnd;
  return {
    leaves,
    councilAttendance: council.filter(inMonth),
    mosqueAttendance: mosque.filter(inMonth),
    recentCouncilAttendance: council,
    recentMosqueAttendance: mosque,
  };
}

async function DashboardWithRecords({
  employee,
  records,
  initialTab,
  viewerIsEmployee,
  mosque,
}: {
  employee: EmployeeDoc;
  records: ReturnType<typeof loadDashboardRecords>;
  initialTab: TabId;
  viewerIsEmployee: boolean;
  mosque?: MosqueProfileData;
}) {
  return (
    <EmployeeDetailsDashboardView
      employee={employee}
      {...await records}
      initialTab={initialTab}
      viewerIsEmployee={viewerIsEmployee}
      mosque={mosque}
    />
  );
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
  const initialTab: TabId =
    requestedTab === "attendance" ||
    requestedTab === "leave" ||
    requestedTab === "pay" ||
    requestedTab === "requests"
      ? requestedTab
      : "overview";

  // Every read starts now. The name and photo show as soon as the employee
  // record arrives, while attendance and leave are still on their way.
  const records = loadDashboardRecords(params.id, month);
  records.catch(() => {
    // Rendering below rethrows it; this only stops an unhandled rejection.
  });
  const employee = await fetchEmployeeById(params.id).catch(() => null);
  if (!employee) return <EmployeeDetailsDashboardView employee={null} />;

  // Mosque staff see each day's five prayers against the scheduled times.
  const mosque = isMosqueEmployee(employee)
    ? {
        schedule: loadPrayerSchedule(mosqueProfileDates(maldivesTodayIso())),
        graceMinutes: graceMinutesForDesignation(
          typeof employee.designation === "string" ? employee.designation : undefined,
        ),
      }
    : undefined;

  return (
    <Suspense
      fallback={
        <DetailsSkeleton
          name={typeof employee.name === "string" ? employee.name : ""}
          designation={typeof employee.designation === "string" ? employee.designation : ""}
          photoUrl={employeePhotoUrl(params.id, employee.photoKey)}
        />
      }
    >
      <DashboardWithRecords
        employee={employee}
        records={records}
        initialTab={initialTab}
        viewerIsEmployee={getEmployeeProfileSessionId() === params.id}
        mosque={mosque}
      />
    </Suspense>
  );
}
