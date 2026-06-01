"use client";

import { queryKeys } from "@/lib/query/keys";
import {
  fetchLeaveRequests,
  fetchUserLeaveRequests,
} from "@/lib/firebase/hr";
import { useQuery } from "@tanstack/react-query";

export function useAdminLeaveRequestsQuery(limit: number, offset: number) {
  return useQuery({
    queryKey: queryKeys.leave.admin(Math.floor(offset / limit) + 1, limit),
    queryFn: () => fetchLeaveRequests(limit, offset),
  });
}

export function useUserLeaveRequestsQuery(
  status: string,
  limit: number,
  offset: number,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.leave.user("current"),
      status,
      limit,
      offset,
    ] as const,
    queryFn: () => fetchUserLeaveRequests(status, limit, offset),
  });
}
