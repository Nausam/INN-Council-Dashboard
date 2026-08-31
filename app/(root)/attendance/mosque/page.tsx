export const dynamic = "force-dynamic";

import { MosqueAttendancePageView } from "@/components/attendance/MosqueAttendancePageView";
import { fetchEnrichedMosqueAttendanceForDate } from "@/lib/attendance/enrich-attendance";
import { dateFromSearchParam } from "@/lib/dates/page-params";

export default async function MosqueAttendancePage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const date = dateFromSearchParam(searchParams?.date);
  const rows = await fetchEnrichedMosqueAttendanceForDate(date);
  return <MosqueAttendancePageView date={date} rows={rows} />;
}
