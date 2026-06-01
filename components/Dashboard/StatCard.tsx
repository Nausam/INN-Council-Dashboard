import { CouncilCard } from "@/components/design-system";
import { shadows, statTones, type StatTone } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import React from "react";

/** @deprecated Use tone — kept for document receiver page */
type LegacyColorScheme = "indigo" | "emerald" | "amber" | "rose";

type StatCardProps = {
  icon: LucideIcon | IconType;
  label: string;
  value: number;
  percentage?: number;
  tone?: StatTone;
  /** @deprecated Use tone="teal" instead of colorScheme="indigo" */
  colorScheme?: LegacyColorScheme;
  compact?: boolean;
};

function resolveTone(
  tone?: StatTone,
  colorScheme?: LegacyColorScheme,
): StatTone {
  if (tone) return tone;
  if (colorScheme === "indigo") return "teal";
  if (colorScheme) return colorScheme;
  return "teal";
}

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  percentage,
  tone,
  colorScheme,
  compact = false,
}) => {
  const colors = statTones[resolveTone(tone, colorScheme)];

  return (
    <CouncilCard interactive="hover" className={cn(compact ? "p-5" : "p-6")}>
      <div className={cn("flex items-start justify-between", compact ? "mb-4" : "mb-5")}>
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl text-white transition-transform duration-200 group-hover:scale-105",
            compact ? "h-11 w-11" : "h-12 w-12",
          )}
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${colors.from}, ${colors.to})`,
            boxShadow: shadows.avatar(colors.glow),
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            colors.light,
            colors.label,
          )}
        >
          Today
        </span>
      </div>

      <p className={cn("mb-1 text-xs font-bold uppercase tracking-wide", colors.label)}>
        {label}
      </p>
      <p
        className={cn(
          "font-black tabular-nums tracking-tight text-slate-900",
          compact ? "text-3xl" : "text-4xl",
        )}
      >
        {value.toLocaleString()}
      </p>

      {percentage !== undefined && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Share of staff</span>
            <span className={colors.label}>{percentage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${percentage}%`,
                backgroundImage: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
              }}
            />
          </div>
        </div>
      )}
    </CouncilCard>
  );
};

export default StatCard;
