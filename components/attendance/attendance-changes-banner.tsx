"use client";

import { CouncilCard } from "@/components/design-system";
import { AlertCircle } from "lucide-react";

type AttendanceChangesBannerProps = {
  count: number;
};

export function AttendanceChangesBanner({ count }: AttendanceChangesBannerProps) {
  if (count <= 0) return null;

  return (
    <CouncilCard
      interactive="none"
      className="border-amber-200/80 bg-amber-50/80 p-4 ring-amber-100"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/70">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-black text-amber-950">
            {count} {count === 1 ? "record" : "records"} modified
          </p>
          <p className="text-xs font-semibold text-amber-800/80">
            Submit your changes before leaving this page.
          </p>
        </div>
      </div>
    </CouncilCard>
  );
}
