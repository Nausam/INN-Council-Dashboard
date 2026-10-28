export const dynamic = "force-dynamic";

import { buildCouncilMonthSummary } from "@/lib/attendance/council-month-summary";
import { monthFromSearchParam } from "@/lib/dates/page-params";
import { CouncilReportsView } from "./CouncilReportsView";

export default async function CouncilReportsPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const month = monthFromSearchParam(searchParams?.month);
  return <CouncilReportsView summary={await buildCouncilMonthSummary(month)} />;
}
