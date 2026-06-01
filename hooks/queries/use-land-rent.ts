"use client";

import { queryKeys } from "@/lib/query/keys";
import {
  fetchLandLeaseOptions,
  fetchLandRentOverview,
  fetchLandStatementsWithDetails,
  previewLandRentStatement,
} from "@/lib/landrent/landRent.actions";
import { useQuery } from "@tanstack/react-query";

export function useLandRentOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.landRent.overview,
    queryFn: () => fetchLandRentOverview(),
  });
}

export function useLandLeaseOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.landRent.leaseOptions,
    queryFn: () => fetchLandLeaseOptions(),
  });
}

export function useLandRentStatementsQuery(
  leaseId: string,
  capToEndDate: boolean,
  enabled = true,
) {
  return useQuery({
    queryKey: [...queryKeys.landRent.statements(leaseId, ""), capToEndDate],
    queryFn: () =>
      fetchLandStatementsWithDetails({ leaseId, capToEndDate }),
    enabled: enabled && Boolean(leaseId),
  });
}

export function useLandRentPreviewQuery(
  leaseId: string,
  monthKey: string,
  capToEndDate: boolean,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.landRent.preview(leaseId, monthKey, capToEndDate),
    queryFn: () =>
      previewLandRentStatement({ leaseId, monthKey, capToEndDate }),
    enabled: enabled && Boolean(leaseId) && Boolean(monthKey),
  });
}
