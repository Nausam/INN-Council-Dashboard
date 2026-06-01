"use client";

import {
  fetchAttendanceForDateAction,
  fetchAllEmployeesAction,
  fetchMosqueAttendanceForDateAction,
} from "@/lib/attendance/attendance.actions";
import {
  QUERY_STALE_TIME_ATTENDANCE,
} from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAttendanceForMonth,
  fetchMosqueAttendanceForMonth,
  fetchMosqueDailyAttendanceForMonth,
  fetchPrayerTimesForMonth,
  fetchPrayerTimesByDate,
} from "@/lib/firebase/hr";
import { useQuery } from "@tanstack/react-query";

export function useCouncilAttendanceQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.attendance.council(date),
    queryFn: async () => {
      const result = await fetchAttendanceForDateAction(date);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(date),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useMosqueAttendanceQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.attendance.mosque(date),
    queryFn: async () => {
      const result = await fetchMosqueAttendanceForDateAction(date);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(date),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useCouncilAttendanceMonthQuery(month: string) {
  return useQuery({
    queryKey: queryKeys.attendance.councilMonth(month),
    queryFn: () => fetchAttendanceForMonth(month),
    enabled: Boolean(month),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useMosqueAttendanceMonthQuery(month: string) {
  return useQuery({
    queryKey: queryKeys.attendance.mosqueMonth(month),
    queryFn: () => fetchMosqueAttendanceForMonth(month),
    enabled: Boolean(month),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useMosqueDailyAttendanceMonthQuery(
  month: string,
  employeeId: string,
) {
  return useQuery({
    queryKey: [...queryKeys.attendance.mosqueDailyMonth(month), employeeId] as const,
    queryFn: () => fetchMosqueDailyAttendanceForMonth(month, employeeId),
    enabled: Boolean(month) && Boolean(employeeId),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function usePrayerTimesMonthQuery(month: string) {
  return useQuery({
    queryKey: queryKeys.prayerTimes.month(month),
    queryFn: () => fetchPrayerTimesForMonth(month),
    enabled: Boolean(month),
  });
}

export function usePrayerTimesByDateQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.prayerTimes.byDate(date),
    queryFn: () => fetchPrayerTimesByDate(date),
    enabled: Boolean(date),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useAllEmployeesActionQuery() {
  return useQuery({
    queryKey: queryKeys.employees.all,
    queryFn: async () => {
      const result = await fetchAllEmployeesAction();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}
