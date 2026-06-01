"use client";

import { QUERY_STALE_TIME_ATTENDANCE } from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAllEmployees,
  fetchAttendanceForDate,
  fetchMosqueAttendanceForDate,
} from "@/lib/firebase/hr";
import { useQuery } from "@tanstack/react-query";

export function useDashboardQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.byDate(date),
    queryFn: async () => {
      const [employees, officeAttendance, mosqueAttendance] = await Promise.all([
        fetchAllEmployees(),
        fetchAttendanceForDate(date),
        fetchMosqueAttendanceForDate(date),
      ]);
      return { employees, officeAttendance, mosqueAttendance };
    },
    enabled: Boolean(date),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}
