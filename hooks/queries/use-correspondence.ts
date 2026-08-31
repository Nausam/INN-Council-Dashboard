"use client";

import { queryKeys } from "@/lib/query/keys";
import {
  getCorrespondenceById,
  getCorrespondenceDashboardStats,
  listCorrespondence,
  type ListCorrespondenceParams,
} from "@/lib/actions/correspondence.actions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useCorrespondenceListQuery(
  params: ListCorrespondenceParams,
  options?: { initialData?: Awaited<ReturnType<typeof listCorrespondence>> },
) {
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
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
  });
}

export function useCorrespondenceStatsQuery(options?: {
  initialData?: Awaited<ReturnType<typeof getCorrespondenceDashboardStats>>;
}) {
  return useQuery({
    queryKey: queryKeys.correspondence.stats,
    queryFn: () => getCorrespondenceDashboardStats(),
    initialData: options?.initialData,
  });
}

export function useCorrespondenceDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.correspondence.detail(id ?? ""),
    queryFn: () => getCorrespondenceById(id!),
    enabled: Boolean(id),
  });
}
