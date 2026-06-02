"use client";

import { prefetchCommonQueries } from "@/lib/query/prefetch";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function QueryWarmup() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void prefetchCommonQueries(queryClient);
  }, [queryClient]);

  return null;
}
