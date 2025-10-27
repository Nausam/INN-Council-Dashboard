"use client";
import React from "react";

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  /** Background gradient behind the glass panel */
  gradient: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  title,
  value,
  gradient,
}) => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        // gradient sits behind the glass
        background: gradient,
      }}
    >
      {/* liquid blobs (very subtle) */}
      <div
        className="pointer-events-none absolute -left-10 -top-8 h-28 w-28 rounded-full blur-2xl opacity-60"
        style={{ background: "linear-gradient(135deg, #ffffff44, #ffffff22)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 -bottom-8 h-24 w-24 rounded-full blur-2xl opacity-50"
        style={{ background: "linear-gradient(135deg, #ffffff33, #ffffff18)" }}
        aria-hidden
      />

      {/* glass panel */}
      <div className="relative m-[1px] rounded-2xl bg-white/12 ring-1 ring-white/25 backdrop-blur-xl">
        {/* inner highlight (glass edge) */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]" />

        <div className="relative p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30">
              {icon}
            </div>
            <h3 className="text-lg lg:text-xl font-medium tracking-tight">
              {title}
            </h3>
          </div>

          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums drop-shadow-sm">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
