export const dynamic = "force-dynamic";

import { CouncilAttendancePageView } from "@/components/attendance/CouncilAttendancePageView";
import { fetchEnrichedAttendanceForDate } from "@/lib/attendance/enrich-attendance";
import { dateFromSearchParam } from "@/lib/dates/page-params";

export default async function CouncilAttendancePage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const date = dateFromSearchParam(searchParams?.date);
  const rows = await fetchEnrichedAttendanceForDate(date);
  return <CouncilAttendancePageView date={date} rows={rows} />;
}
