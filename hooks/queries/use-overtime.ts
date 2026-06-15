"use client";

import { queryKeys } from "@/lib/query/keys";
import { fetchOvertimeRequests } from "@/lib/firebase/hr";
import { useQuery } from "@tanstack/react-query";

export function useAdminOvertimeRequestsQuery(limit: number, offset: number) {
  return useQuery({
    queryKey: queryKeys.overtime.admin(Math.floor(offset / limit) + 1, limit),
    queryFn: () => fetchOvertimeRequests(limit, offset),
  });
}
