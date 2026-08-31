export const dynamic = "force-dynamic";

import { DashboardPageView } from "@/components/Dashboard/DashboardPageView";
import { fetchDashboardSummary } from "@/lib/dashboard/summary";
import { dateFromSearchParam } from "@/lib/dates/page-params";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const date = dateFromSearchParam(searchParams?.date);
  const data = await fetchDashboardSummary(date);
  return <DashboardPageView date={date} data={data} />;
}
