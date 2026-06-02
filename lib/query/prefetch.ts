import {
  fetchAttendanceForDateAction,
  fetchMosqueAttendanceForDateAction,
} from "@/lib/attendance/attendance.actions";
import {
  fetchAllEmployees,
  fetchAttendanceForDate,
  fetchMosqueAttendanceForDate,
} from "@/lib/firebase/hr";
import {
  QUERY_STALE_TIME,
  QUERY_STALE_TIME_ATTENDANCE,
} from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";

function getTodayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0]!;
}

export function prefetchEmployees(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.employees.all,
    queryFn: () => fetchAllEmployees(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function prefetchDashboardForToday(queryClient: QueryClient) {
  const date = getTodayIso();
  return queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.byDate(date),
    queryFn: async () => {
      const [employees, officeAttendance, mosqueAttendance] = await Promise.all([
        fetchAllEmployees(),
        fetchAttendanceForDate(date),
        fetchMosqueAttendanceForDate(date),
      ]);
      return { employees, officeAttendance, mosqueAttendance };
    },
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function prefetchCouncilAttendanceForToday(queryClient: QueryClient) {
  const date = getTodayIso();
  return queryClient.prefetchQuery({
    queryKey: queryKeys.attendance.council(date),
    queryFn: async () => {
      const result = await fetchAttendanceForDateAction(date);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function prefetchMosqueAttendanceForToday(queryClient: QueryClient) {
  const date = getTodayIso();
  return queryClient.prefetchQuery({
    queryKey: queryKeys.attendance.mosque(date),
    queryFn: async () => {
      const result = await fetchMosqueAttendanceForDateAction(date);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function prefetchCommonQueries(queryClient: QueryClient) {
  return Promise.allSettled([
    prefetchEmployees(queryClient),
    prefetchDashboardForToday(queryClient),
  ]);
}

export function prefetchRouteQueries(queryClient: QueryClient, path: string) {
  if (path === "/" || path.startsWith("/admin")) {
    return prefetchDashboardForToday(queryClient);
  }

  if (path.startsWith("/employees") || path.startsWith("/salary-slips")) {
    return prefetchEmployees(queryClient);
  }

  if (path.startsWith("/attendance/council")) {
    return Promise.allSettled([
      prefetchCouncilAttendanceForToday(queryClient),
      prefetchEmployees(queryClient),
    ]);
  }

  if (path.startsWith("/attendance/mosque")) {
    return Promise.allSettled([
      prefetchMosqueAttendanceForToday(queryClient),
      prefetchEmployees(queryClient),
    ]);
  }

  return undefined;
}
