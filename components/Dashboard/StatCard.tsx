import React from "react";
import { IconType } from "react-icons";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type ColorScheme = "indigo" | "emerald" | "amber" | "rose";

interface StatCardProps {
  icon: IconType;
  label: string;
  value: number;
  percentage?: number;
  colorScheme: ColorScheme;
  compact?: boolean;
}

interface ColorConfig {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  textPrimary: string;
  textSecondary: string;
}

// ============================================================================
// REDESIGNED STATCARD COMPONENT - Modern Neumorphic Glass Style
// ============================================================================

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  percentage,
  colorScheme,
  compact = false,
}) => {
  const colors: Record<ColorScheme, ColorConfig> = {
    indigo: {
      primary: "#6366f1",
      secondary: "#4f46e5",
      accent: "#818cf8",
      glow: "rgba(99, 102, 241, 0.4)",
      textPrimary: "#1e1b4b",
      textSecondary: "#4338ca",
    },
    emerald: {
      primary: "#10b981",
      secondary: "#059669",
      accent: "#34d399",
      glow: "rgba(16, 185, 129, 0.4)",
      textPrimary: "#064e3b",
      textSecondary: "#047857",
    },
    amber: {
      primary: "#f59e0b",
      secondary: "#d97706",
      accent: "#fbbf24",
      glow: "rgba(245, 158, 11, 0.4)",
      textPrimary: "#78350f",
      textSecondary: "#b45309",
    },
    rose: {
      primary: "#f43f5e",
      secondary: "#e11d48",
      accent: "#fb7185",
      glow: "rgba(244, 63, 94, 0.4)",
      textPrimary: "#881337",
      textSecondary: "#be123c",
    },
  };

  const color = colors[colorScheme];

  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden bg-gradient-to-br from-white/90 to-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl",
        compact ? "rounded-2xl p-5" : "rounded-3xl p-8",
      )}
      style={{
        boxShadow: `
          0 4px 24px -2px rgba(0, 0, 0, 0.08),
          0 0 0 1px rgba(0, 0, 0, 0.04),
          inset 0 0 0 1px rgba(255, 255, 255, 0.5)
        `,
      }}
    >
      {/* Animated Gradient Background */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at top right, ${color.glow}, transparent 70%)`,
        }}
      />

      {/* Decorative Corner Element */}
      <div
        className={cn(
          "absolute rounded-full opacity-20 blur-3xl transition-transform duration-700 group-hover:scale-150",
          compact ? "-right-6 -top-6 h-24 w-24" : "-right-8 -top-8 h-32 w-32",
        )}
        style={{ background: color.primary }}
      />

      {/* Content Container */}
      <div className="relative z-10">
        {/* Icon Section */}
        <div className={cn("flex items-start justify-between", compact ? "mb-4" : "mb-6")}>
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
              compact ? "h-12 w-12" : "h-16 w-16",
            )}
            style={{
              background: `linear-gradient(135deg, ${color.primary}, ${color.secondary})`,
              boxShadow: `0 8px 16px -4px ${color.glow}`,
            }}
          >
            <Icon className={cn("text-white", compact ? "h-5 w-5" : "h-7 w-7")} />
          </div>

          {/* Trend Indicator (decorative) */}
          <div
            className={cn(
              "flex items-center gap-1 rounded-full bg-white/60 shadow-sm backdrop-blur-sm",
              compact ? "h-7 px-2.5" : "h-8 px-3",
            )}
          >
            <div
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: color.primary }}
            />
            <span
              className={cn("font-bold", compact ? "text-[11px]" : "text-xs")}
              style={{ color: color.textSecondary }}
            >
              Live
            </span>
          </div>
        </div>

        {/* Label */}
        <p
          className={cn(
            "font-semibold uppercase tracking-wider",
            compact ? "mb-1.5 text-xs" : "mb-2 text-sm",
          )}
          style={{ color: color.textSecondary }}
        >
          {label}
        </p>

        {/* Value with animated counting effect styling */}
        <div className={cn(compact ? "mb-2" : "mb-4")}>
          <p
            className={cn(
              "font-black tracking-tight transition-all duration-300",
              compact ? "text-4xl" : "text-5xl",
            )}
            style={{
              color: color.textPrimary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value.toLocaleString()}
          </p>
        </div>

        {/* Percentage Badge */}
        {percentage !== undefined && (
          <div className="flex items-center gap-2">
            <div
              className="relative overflow-hidden rounded-full px-4 py-1.5 shadow-md"
              style={{
                background: `linear-gradient(90deg, ${color.primary}, ${color.secondary})`,
              }}
            >
              <div className="absolute inset-0 bg-white/20" />
              <div className="relative flex items-center gap-1.5">
                <svg
                  className="h-3 w-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-bold text-white">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/50">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${color.primary}, ${color.accent})`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decorative Border Glow on Hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          compact ? "rounded-2xl" : "rounded-3xl",
        )}
        style={{
          background: `linear-gradient(135deg, ${color.glow}, transparent)`,
          padding: "2px",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
    </div>
  );
};

export default StatCard;
