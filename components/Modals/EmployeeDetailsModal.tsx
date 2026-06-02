"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import { EmployeeModalShell } from "@/components/Modals/EmployeeModalShell";
import { AvatarGlow, SectionBadge } from "@/components/design-system";
import { useEmployeeQuery } from "@/hooks/queries";
import { toEmployeeForDetails } from "@/lib/employees/transforms";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

type EmployeeDetailsModalProps = {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview?: {
    name: string;
    designation: string;
    section?: string;
  };
};

export function EmployeeDetailsModal({
  employeeId,
  open,
  onOpenChange,
  preview,
}: EmployeeDetailsModalProps) {
  const { data, isPending, isError } = useEmployeeQuery(
    open ? (employeeId ?? undefined) : undefined,
  );

  const employee = useMemo(
    () => (data ? toEmployeeForDetails(data) : null),
    [data],
  );

  const displayName = employee?.name ?? preview?.name ?? "Employee";
  const displayDesignation =
    employee?.designation ?? preview?.designation ?? "";
  const displaySection = employee?.section ?? preview?.section;

  return (
    <EmployeeModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Employee Profile"
      description={displayName}
      size="xl"
      header={
        <div className="flex items-start gap-4 pr-12">
          <AvatarGlow name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">
              {displayName}
            </h2>
            {displayDesignation ? (
              <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                {displayDesignation}
              </p>
            ) : null}
            {displaySection ? (
              <div className="mt-3">
                <SectionBadge section={displaySection} />
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="p-6 sm:p-8">
        {isPending && !employee ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-slate-600">
              Loading profile…
            </p>
          </div>
        ) : isError || !employee ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Could not load employee details
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Please try again or refresh the page.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 fill-mode-both">
            <EmployeeDetailsCard employee={employee} />
          </div>
        )}
      </div>
    </EmployeeModalShell>
  );
}
