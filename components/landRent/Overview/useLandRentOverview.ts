"use client";

import { useLandRentOverviewQuery } from "@/hooks/queries";
import type { LandRentOverviewUIRow } from "./landRentOverview.utils";

export function useLandRentOverview(initialRows?: LandRentOverviewUIRow[]) {
  const { data, isLoading, error, refetch } = useLandRentOverviewQuery({
    initialData: initialRows,
  });

  return {
    rows: (data ?? initialRows ?? []) as LandRentOverviewUIRow[],
    loading: isLoading && !initialRows,
    error: error?.message ?? null,
    refetch,
  };
}
