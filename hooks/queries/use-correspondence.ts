"use client";

import { queryKeys } from "@/lib/query/keys";
import {
  getCorrespondenceById,
  getCorrespondenceDashboardStats,
  listCorrespondence,
  type ListCorrespondenceParams,
} from "@/lib/actions/correspondence.actions";
import { useQuery } from "@tanstack/react-query";

export function useCorrespondenceListQuery(params: ListCorrespondenceParams) {
  const filterKey = {
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
    status: params.status ?? "all",
    receivedFrom: params.receivedFrom ?? "",
    receivedTo: params.receivedTo ?? "",
    search: params.search ?? "",
  };

  return useQuery({
    queryKey: queryKeys.correspondence.list(filterKey),
    queryFn: () => listCorrespondence(params),
  });
}

export function useCorrespondenceStatsQuery() {
  return useQuery({
    queryKey: queryKeys.correspondence.stats,
    queryFn: () => getCorrespondenceDashboardStats(),
  });
}

export function useCorrespondenceDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.correspondence.detail(id ?? ""),
    queryFn: () => getCorrespondenceById(id!),
    enabled: Boolean(id),
  });
}
