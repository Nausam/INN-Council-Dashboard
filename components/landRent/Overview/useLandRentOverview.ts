"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { fetchLandRentOverview } from "@/lib/landrent/landRent.actions";
import { useCallback, useEffect, useState } from "react";
import type { LandRentOverviewUIRow } from "./landRentOverview.utils";

export function useLandRentOverview() {
  const [rows, setRows] = useState<LandRentOverviewUIRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;

    setLoading(true);
    setError(null);

    fetchLandRentOverview()
      .then((r) => {
        if (!alive) return;
        setRows((r ?? []) as LandRentOverviewUIRow[]);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load land rents.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  return { rows, loading, error, refetch: load };
}
