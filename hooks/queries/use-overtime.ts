"use client";

import { queryKeys } from "@/lib/query/keys";
import { fetchOvertimeRequests } from "@/lib/actions/hr.actions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useAdminOvertimeRequestsQuery(
  limit: number,
  offset: number,
  options?: { initialData?: Awaited<ReturnType<typeof fetchOvertimeRequests>> },
) {
  return useQuery({
    queryKey: queryKeys.overtime.admin(Math.floor(offset / limit) + 1, limit),
    queryFn: () => fetchOvertimeRequests(limit, offset),
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
  });
}
