"use client";

import { queryKeys } from "@/lib/query/keys";
import { fetchLeaveRequests } from "@/lib/actions/hr.actions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useAdminLeaveRequestsQuery(
  limit: number,
  offset: number,
  options?: { initialData?: Awaited<ReturnType<typeof fetchLeaveRequests>> },
) {
  return useQuery({
    queryKey: queryKeys.leave.admin(Math.floor(offset / limit) + 1, limit),
    queryFn: () => fetchLeaveRequests(limit, offset),
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
  });
}

