"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import React from "react";

type StatCardProps = {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "red";
  trend?: { delta: number; label?: string }; // e.g., { delta: +4 }
  className?: string;
};

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  blue: "from-sky-500/15 to-blue-500/10",
  green: "from-emerald-500/15 to-lime-500/10",
  amber: "from-amber-500/15 to-orange-500/10",
  red: "from-rose-500/15 to-red-500/10",
};

export default function StatCard({
  title,
  value,
  icon,
  tone = "blue",
  trend,
  className,
}: StatCardProps) {
  const TrendIcon = trend && trend.delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card
      className={cn("surface card-hover relative overflow-hidden", className)}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          toneStyles[tone]
        )}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="size-9 rounded-xl grid place-items-center bg-white/70 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10">
            {icon}
          </div>
          {trend && (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 rounded-full",
                trend.delta >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.delta >= 0 ? "+" : ""}
              {trend.delta}
              {trend.label ? ` ${trend.label}` : ""}
            </Badge>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[13px] text-black/60 dark:text-white/60">
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
