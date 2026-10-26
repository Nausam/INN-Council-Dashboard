export const dynamic = "force-dynamic";

import { fetchAttendanceReport } from "@/lib/actions/hr.actions";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import { AttendanceReportView } from "./AttendanceReportView";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const month = monthFromSearchParam(searchParams?.month);
  const report = await fetchAttendanceReport(month);
  return <AttendanceReportView report={report} />;
}
