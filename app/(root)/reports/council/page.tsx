export const dynamic = "force-dynamic";

import {
  fetchAllEmployees,
  fetchAttendanceForMonth,
} from "@/lib/actions/hr.actions";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import { CouncilReportsView } from "./CouncilReportsView";

export default async function CouncilReportsPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const month = monthFromSearchParam(searchParams?.month);
  const [initialEmployees, initialAttendance] = await Promise.all([
    fetchAllEmployees(),
    fetchAttendanceForMonth(month),
  ]);
  return (
    <CouncilReportsView
      month={month}
      initialEmployees={initialEmployees}
      initialAttendance={initialAttendance}
    />
  );
}
