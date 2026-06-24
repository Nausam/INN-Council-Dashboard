"use client";

import { QUERY_STALE_TIME } from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import type { SalarySlipComputed } from "@/lib/salary-slips/compute-slip";
import { useQuery } from "@tanstack/react-query";

export function useUploadedSlipsQuery(periodLabel: string) {
  return useQuery({
    queryKey: queryKeys.salarySlips.uploaded(periodLabel),
    queryFn: async () => {
      const res = await fetch(
        `/api/salary-slips/uploaded?period=${encodeURIComponent(periodLabel)}`,
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.recordCardNumbers)) {
        return new Set<string>();
      }
      return new Set<string>(data.recordCardNumbers as string[]);
    },
    enabled: Boolean(periodLabel),
  });
}

export function useGeneratedSlipForEmployeeQuery(
  periodLabel: string,
  employeeId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.salarySlips.generatedForEmployee(
      periodLabel,
      employeeId ?? "",
    ),
    queryFn: async (): Promise<SalarySlipComputed | null> => {
      const res = await fetch(
        `/api/salary-slips/generated?period=${encodeURIComponent(
          periodLabel,
        )}&employeeId=${encodeURIComponent(employeeId ?? "")}`,
      );
      // A 404 means the employee genuinely has no slip for this period.
      if (res.status === 404) return null;
      // Any other failure should retry, not be cached as "no slip".
      if (!res.ok) {
        throw new Error(`Failed to load salary slip (${res.status})`);
      }
      const data = await res.json();
      const slips = (data.slips ?? []) as SalarySlipComputed[];
      return slips[0] ?? null;
    },
    enabled:
      Boolean(periodLabel) &&
      Boolean(employeeId) &&
      (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useSalarySlipsByRecordQuery(recordCard: string) {
  return useQuery({
    queryKey: queryKeys.salarySlips.byRecord(recordCard),
    queryFn: async () => {
      const res = await fetch(
        `/api/salary-slips?recordCard=${encodeURIComponent(recordCard)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load slips");
      return data;
    },
    enabled: Boolean(recordCard.trim()),
  });
}
