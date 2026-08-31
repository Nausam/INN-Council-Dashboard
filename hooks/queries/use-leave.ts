"use client";

import { queryKeys } from "@/lib/query/keys";
import {
  fetchLeaveRequests,
  fetchUserLeaveRequests,
} from "@/lib/actions/hr.actions";
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

export function useUserLeaveRequestsQuery(
  status: string,
  limit: number,
  offset: number,
  options?: { initialData?: Awaited<ReturnType<typeof fetchUserLeaveRequests>> },
) {
  return useQuery({
    queryKey: [
      ...queryKeys.leave.user("current"),
      status,
      limit,
      offset,
    ] as const,
    queryFn: () => fetchUserLeaveRequests(status, limit, offset),
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
  });
}
