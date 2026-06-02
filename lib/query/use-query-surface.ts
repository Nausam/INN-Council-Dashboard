import type { UseQueryResult } from "@tanstack/react-query";

type QuerySurfaceInput<T> = Pick<
  UseQueryResult<T>,
  "data" | "isPending" | "isFetching"
>;

/** Use cached data immediately; only block UI when nothing is in cache yet. */
export function getQuerySurface<T>(query: QuerySurfaceInput<T>) {
  const hasCachedData = query.data !== undefined;

  return {
    hasCachedData,
    showInitialLoad: query.isPending,
    showRefresh: query.isFetching && hasCachedData,
  };
}
