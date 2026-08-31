"use client";

import { QUERY_STALE_TIME_ATTENDANCE } from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import { fetchDashboardSummary } from "@/lib/dashboard/summary";
import { useQuery } from "@tanstack/react-query";

export function useDashboardQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.byDate(date),
    queryFn: () => fetchDashboardSummary(date),
    enabled: Boolean(date),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}
