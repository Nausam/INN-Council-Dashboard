export const dynamic = "force-dynamic";

import { buildCouncilMonthSummary, monthRange } from "@/lib/attendance/council-month-summary";
import { monthFromSearchParam, searchParamString } from "@/lib/dates/page-params";
import { CouncilReportsView } from "./CouncilReportsView";

export default async function CouncilReportsPage({
  searchParams,
}: {
  searchParams?: { month?: string; from?: string; to?: string };
}) {
  // ?from=&to= for a date range; otherwise a whole month (this month by default).
  const from = searchParamString(searchParams?.from);
  const to = searchParamString(searchParams?.to);
  const { start, end } = from && to ? { start: from, end: to } : monthRange(monthFromSearchParam(searchParams?.month));
  return <CouncilReportsView summary={await buildCouncilMonthSummary(start, end)} />;
}
