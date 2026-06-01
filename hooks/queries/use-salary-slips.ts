"use client";

import { queryKeys } from "@/lib/query/keys";
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
