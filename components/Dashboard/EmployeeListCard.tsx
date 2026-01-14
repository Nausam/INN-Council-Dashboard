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
    if (!leaveType) return { bg: bgColor, text: "Not specified" };

    const type = leaveType.toLowerCase();

    if (type.includes("sick")) {
      return { bg: "#ef4444", text: "Sick Leave" };
    } else if (type.includes("annual") || type.includes("vacation")) {
      return { bg: "#3b82f6", text: "Annual Leave" };
    } else if (type.includes("family")) {
      return { bg: "#f97316", text: "Family Leave" };
    } else if (type.includes("certificate")) {
      return { bg: "#dc2626", text: "Certificate Leave" };
    } else if (type.includes("personal")) {
      return { bg: "#8b5cf6", text: "Personal Leave" };
    } else if (type.includes("maternity") || type.includes("paternity")) {
      return { bg: "#ec4899", text: "Pre-Maternity Leave" };
    } else if (type.includes("nopay")) {
      return { bg: "#64748b", text: "No Pay Leave" };
    } else if (type.includes("bereavement")) {
      return { bg: "#475569", text: "Bereavement Leave" };
    } else {
      // Use the original leave type as-is
      return { bg: bgColor, text: leaveType };
    }
  };

  return (
    <Card className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-all hover:shadow-lg">
      {/* Minimal header - no gradient background */}
      <CardHeader className="border-b border-slate-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: bgColor }}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
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
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                {title}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {employees.length}{" "}
                {employees.length === 1 ? "person" : "people"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {employees.length > 0 ? (
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
                : { bg: bgColor, text: "Late" };

              return (
                <div
                  key={`${name}-${i}`}
                  className="group/item flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                >
                  {/* Avatar with initial */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ring-2 ring-white transition-transform group-hover/item:scale-105"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initial}
                  </div>

                  {/* Name and number */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {name}
                    </p>
                    {/* <p className="text-xs text-slate-500">
                      Employee #{String(i + 1).padStart(2, "0")}
                    </p> */}
                  </div>

                  {/* Status badge */}
                  <div
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: leaveStyle.bg }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                    {leaveStyle.text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg
                className="h-8 w-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
            <p className="mt-1 text-xs text-slate-500">All clear for now</p>
          </div>
        )}
      </CardContent>

      {/* Footer summary - only show if there are employees */}
      {employees.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <p className="text-xs text-slate-600">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {employees.length}
            </span>{" "}
            {employees.length === 1 ? "employee" : "employees"}
          </p>
        </div>
      )}
    </Card>
  );
};

export default EmployeeListCard;
