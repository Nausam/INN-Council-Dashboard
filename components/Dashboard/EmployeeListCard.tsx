import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

interface Employee {
  name: string;
  leaveType?: string | null;
}

interface EmployeeListCardProps {
  title: string;
  employees: Employee[];
  bgColor: string;
  emptyMessage: string;
  gradient: string;
}

const EmployeeListCard: React.FC<EmployeeListCardProps> = ({
  title,
  employees,
  bgColor,
  emptyMessage,
  gradient,
}) => {
  // Determine theme
  const isLeaveCard = gradient.includes("f43f5e");

  // Leave type color mapping
  const getLeaveTypeStyle = (leaveType: string | null | undefined) => {
    if (!leaveType)
      return { bg: bgColor, text: "Not specified", light: `${bgColor}20` };

    const type = leaveType.toLowerCase();

    if (type.includes("sick")) {
      return { bg: "#ef4444", text: "Sick Leave", light: "#fef2f2" };
    } else if (type.includes("annual") || type.includes("vacation")) {
      return { bg: "#3b82f6", text: "Annual Leave", light: "#eff6ff" };
    } else if (type.includes("family")) {
      return { bg: "#f97316", text: "Family Leave", light: "#fff7ed" };
    } else if (type.includes("certificate")) {
      return { bg: "#dc2626", text: "Certificate Leave", light: "#fef2f2" };
    } else if (type.includes("personal")) {
      return { bg: "#8b5cf6", text: "Personal Leave", light: "#faf5ff" };
    } else if (type.includes("maternity") || type.includes("paternity")) {
      return { bg: "#ec4899", text: "Pre-Maternity Leave", light: "#fdf4ff" };
    } else if (type.includes("nopay")) {
      return { bg: "#64748b", text: "No Pay Leave", light: "#f8fafc" };
    } else if (type.includes("bereavement")) {
      return { bg: "#475569", text: "Bereavement Leave", light: "#f8fafc" };
    } else {
      return { bg: bgColor, text: leaveType, light: `${bgColor}20` };
    }
  };

  return (
    <div
      className="group relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/90 to-white/60 backdrop-blur-xl transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl"
      style={{
        boxShadow: `
          0 4px 24px -2px rgba(0, 0, 0, 0.08),
          0 0 0 1px rgba(0, 0, 0, 0.04),
          inset 0 0 0 1px rgba(255, 255, 255, 0.5)
        `,
      }}
    >
      {/* Decorative Corner Element */}
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{ background: bgColor }}
      />

      {/* Header */}
      <div className="relative border-b border-slate-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon Container */}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
              style={{
                background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
                boxShadow: `0 8px 16px -4px ${bgColor}40`,
              }}
            >
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                {isLeaveCard ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                )}
              </svg>
            </div>

            {/* Title and Count */}
            <div>
              <h3
                className="text-xl font-black tracking-tight text-slate-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {title}
              </h3>
              <p
                className="mt-0.5 text-sm font-semibold"
                style={{ color: bgColor }}
              >
                {employees.length}{" "}
                {employees.length === 1 ? "person" : "people"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className="flex h-10 items-center gap-2 rounded-full px-4 shadow-md"
            style={{
              background: `linear-gradient(90deg, ${bgColor}, ${bgColor}dd)`,
            }}
          >
            <div className="relative">
              <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
              <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-white/50" />
            </div>
            <span className="text-sm font-bold text-white">
              {employees.length}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {employees.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            <div className="divide-y divide-slate-100">
              {employees.map((employee, i) => {
                const name =
                  typeof employee === "string" ? employee : employee.name;
                const leaveType =
                  typeof employee === "string" ? null : employee.leaveType;

                // Generate a consistent but varied color for each initial
                const initial = name?.trim()?.charAt(0)?.toUpperCase() || "?";
                const colors = [
                  "#6366f1",
                  "#8b5cf6",
                  "#ec4899",
                  "#f43f5e",
                  "#f59e0b",
                  "#10b981",
                  "#06b6d4",
                  "#3b82f6",
                  "#14b8a6",
                  "#a855f7",
                  "#f97316",
                  "#84cc16",
                  "#22c55e",
                  "#0ea5e9",
                  "#d946ef",
                  "#ef4444",
                  "#eab308",
                  "#06b6d4",
                  "#f43f5e",
                  "#10b981",
                  "#8b5cf6",
                  "#ec4899",
                  "#14b8a6",
                  "#f59e0b",
                  "#6366f1",
                  "#f97316",
                  "#a855f7",
                  "#22c55e",
                  "#0ea5e9",
                  "#84cc16",
                  "#d946ef",
                  "#ef4444",
                  "#eab308",
                  "#06b6d4",
                  "#10b981",
                ];
                const colorIndex = initial.charCodeAt(0) % colors.length;
                const avatarColor = colors[colorIndex];

                // Get leave type styling
                const leaveStyle = isLeaveCard
                  ? getLeaveTypeStyle(leaveType)
                  : { bg: bgColor, text: "Late", light: `${bgColor}20` };

                return (
                  <div
                    key={`${name}-${i}`}
                    className="group/item relative flex items-center gap-4 px-6 py-4 transition-all duration-300 hover:bg-slate-50/50"
                  >
                    {/* Hover Background Effect */}
                    <div
                      className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/item:opacity-100"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${leaveStyle.light}, transparent)`,
                      }}
                    />

                    {/* Avatar with Glass Effect */}
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-full opacity-30 blur-lg"
                        style={{ background: avatarColor }}
                      />
                      <div
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-lg ring-2 ring-white transition-all duration-300 group-hover/item:scale-110"
                        style={{
                          backgroundColor: avatarColor,
                          boxShadow: `0 4px 12px -2px ${avatarColor}60`,
                        }}
                      >
                        {initial}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="relative flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 truncate">
                        {name}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Employee #{String(i + 1).padStart(3, "0")}
                      </p>
                    </div>

                    {/* Status Badge with Glass Effect */}
                    <div className="relative">
                      <div
                        className="relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all duration-300 group-hover/item:scale-105"
                        style={{
                          backgroundColor: leaveStyle.bg,
                          boxShadow: `0 4px 12px -2px ${leaveStyle.bg}60`,
                        }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                        {leaveStyle.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            {/* Empty State Icon */}
            <div
              className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl transition-all duration-500 hover:scale-110"
              style={{
                background: `linear-gradient(135deg, ${bgColor}20, ${bgColor}10)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-3xl opacity-50 blur-xl"
                style={{ background: bgColor }}
              />
              <svg
                className="relative h-10 w-10"
                style={{ color: bgColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <p className="text-base font-bold text-slate-900">{emptyMessage}</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              All clear for now
            </p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {employees.length > 0 && (
        <div
          className="relative border-t border-slate-200/50 px-6 py-4"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.5))",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Total: <span className="text-slate-900">{employees.length}</span>{" "}
              {employees.length === 1 ? "employee" : "employees"}
            </p>

            {/* Decorative Progress Indicator */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(employees.length, 8) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: bgColor,
                      opacity: 0.3 + i * 0.1,
                    }}
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeListCard;
