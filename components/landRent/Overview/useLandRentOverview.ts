"use client";

import { useLandRentOverviewQuery } from "@/hooks/queries";
import type { LandRentOverviewUIRow } from "./landRentOverview.utils";

export function useLandRentOverview() {
  const { data, isLoading, error, refetch } = useLandRentOverviewQuery();

  return {
    rows: (data ?? []) as LandRentOverviewUIRow[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
