"use client";

import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { LayoutDashboard } from "lucide-react";

type DashboardHeaderProps = {
  dateLabel: string;
  className?: string;
};

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  dateLabel,
  className,
}) => {
  return (
    <div className={cn("mb-10", className)}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200/50">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        <span className={typography.sidebarOverline}>{dateLabel}</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="council-page-icon h-14 w-14 rounded-2xl">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <div>
            <h1 className={typography.pageTitle}>Dashboard</h1>
            <p className={typography.pageSubtitle}>
              Innamaadhoo Council — attendance overview
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
