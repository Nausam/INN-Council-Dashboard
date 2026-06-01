import { AvatarGlow, CouncilCard, EmptyState } from "@/components/design-system";
import {
  getLeaveTypeStyle,
  leaveTypeStyles,
  shadows,
  statTones,
  type StatTone,
  typography,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, Timer } from "lucide-react";
import React from "react";

interface Employee {
  name: string;
  leaveType?: string | null;
}

interface EmployeeListCardProps {
  title: string;
  employees: Employee[];
  tone: StatTone;
  emptyMessage: string;
  variant?: "leave" | "late";
}

const EmployeeListCard: React.FC<EmployeeListCardProps> = ({
  title,
  employees,
  tone,
  emptyMessage,
  variant = "leave",
}) => {
  const colors = statTones[tone];

  return (
    <CouncilCard interactive="none" className="flex h-full w-full flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{
              backgroundImage: `linear-gradient(to bottom right, ${colors.from}, ${colors.to})`,
              boxShadow: shadows.avatar(colors.glow),
            }}
          >
            {variant === "leave" ? (
              <Clock3 className="h-5 w-5" strokeWidth={2.2} />
            ) : (
              <Timer className="h-5 w-5" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
              {title}
            </h3>
            <p className={cn("text-sm font-semibold", colors.label)}>
              {employees.length} {employees.length === 1 ? "person" : "people"}
            </p>
          </div>
        </div>
        <span
          className="rounded-xl px-3 py-1.5 text-sm font-black tabular-nums text-white"
          style={{
            backgroundImage: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
          }}
        >
          {employees.length}
        </span>
      </div>

      {employees.length > 0 ? (
        <div className="max-h-[420px] flex-1 overflow-y-auto">
          <ul className="divide-y divide-slate-100">
            {employees.map((employee, i) => {
              const name =
                typeof employee === "string" ? employee : employee.name;
              const leaveType =
                typeof employee === "string" ? null : employee.leaveType;
              const status =
                variant === "leave"
                  ? getLeaveTypeStyle(leaveType)
                  : leaveTypeStyles.late;

              return (
                <li
                  key={`${name}-${i}`}
                  className="flex items-center gap-3 px-6 py-4 transition-colors duration-200 hover:bg-slate-50/80"
                >
                  <AvatarGlow name={name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cn(typography.heading, "truncate text-base")}>
                      {name}
                    </p>
                    <p className={cn(typography.body, "text-xs font-medium")}>
                      Employee
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold",
                      status.pill,
                    )}
                  >
                    {status.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title={emptyMessage}
          description="All clear for the selected date"
          className="m-4 border-solid bg-white shadow-none ring-0"
        />
      )}

      {employees.length > 0 && (
        <div className="council-card-footer mx-4 mb-4 mt-2">
          <span className={typography.caption}>
            Total: {employees.length}{" "}
            {employees.length === 1 ? "employee" : "employees"}
          </span>
        </div>
      )}
    </CouncilCard>
  );
};

export default EmployeeListCard;
