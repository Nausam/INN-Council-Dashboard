"use client";

import {
  QUERY_STALE_TIME,
  QUERY_STALE_TIME_ATTENDANCE,
} from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAllEmployees,
  fetchEmployeeById,
  fetchEmployeeLeaveCalendar,
  fetchMosqueAssistants,
} from "@/lib/firebase/hr";
import { useQuery } from "@tanstack/react-query";

export function useEmployeesQuery() {
  return useQuery({
    queryKey: queryKeys.employees.all,
    queryFn: () => fetchAllEmployees(),
    staleTime: QUERY_STALE_TIME,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });
}

export function useEmployeeQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id ?? ""),
    queryFn: () => fetchEmployeeById(id!),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useEmployeeLeaveCalendarQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.leaveCalendar(id ?? ""),
    queryFn: () => fetchEmployeeLeaveCalendar(id!),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIME_ATTENDANCE,
  });
}

export function useMosqueAssistantsQuery() {
  return useQuery({
    queryKey: queryKeys.mosque.assistants,
    queryFn: () => fetchMosqueAssistants(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useEmployeeOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.employees.options,
    queryFn: async () => {
      const list = await fetchAllEmployees();
      return list
        .map((e) => {
          const id = e.$id ?? (e as Record<string, unknown>).id;
          const rc = e.recordCardNumber;
          const recordCard =
            typeof rc === "string" ? rc.trim() : "";
          if (!recordCard || typeof id !== "string") return null;
          return {
            id,
            name: e.name ?? "Unknown",
            recordCardNumber: recordCard,
          };
        })
        .filter(
          (o): o is { id: string; name: string; recordCardNumber: string } =>
            o !== null,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export { QUERY_STALE_TIME_ATTENDANCE };
