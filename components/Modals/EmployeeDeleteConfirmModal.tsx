"use client";

import { EmployeeModalShell } from "@/components/Modals/EmployeeModalShell";
import { AvatarGlow } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useQueryInvalidation } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { deleteEmployeeRecord } from "@/lib/firebase/hr";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

type EmployeeDeleteTarget = {
  $id: string;
  name: string;
  designation?: string;
};

type EmployeeDeleteConfirmModalProps = {
  employee: EmployeeDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (employeeId: string) => void;
};

export function EmployeeDeleteConfirmModal({
  employee,
  open,
  onOpenChange,
  onDeleted,
}: EmployeeDeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const { invalidateEmployees } = useQueryInvalidation();

  const displayName = employee?.name ?? "this employee";

  const handleDelete = async () => {
    if (!employee?.$id) return;
    setDeleting(true);
    try {
      await deleteEmployeeRecord(employee.$id);
      await invalidateEmployees(employee.$id);
      toast({
        title: "Employee deleted",
        description: `${employee.name} was removed from the directory.`,
      });
      onDeleted?.(employee.$id);
      onOpenChange(false);
    } catch {
      toast({
        title: "Delete failed",
        description: `Could not delete ${employee.name}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <EmployeeModalShell
      open={open}
      onOpenChange={(next) => {
        if (!deleting) onOpenChange(next);
      }}
      title="Delete employee"
      description={`Confirm removal of ${displayName}`}
      size="md"
      header={
        <div className="flex items-start gap-4 pr-12">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/25">
            <Trash2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Delete employee?
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              This action cannot be undone
            </p>
          </div>
        </div>
      }
    >
      <div className="animate-in fade-in duration-300 fill-mode-both p-6 sm:p-8">
        {employee ? (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 ring-1 ring-slate-200/50">
            <AvatarGlow name={employee.name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">{employee.name}</p>
              {employee.designation ? (
                <p className="truncate text-sm font-medium text-slate-600">
                  {employee.designation}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 ring-1 ring-amber-100">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden
          />
          <p className="text-sm font-medium leading-relaxed text-amber-950/90">
            <span className="font-bold">{displayName}</span> will be permanently
            removed from the employee directory. Attendance and salary slip
            records linked to this employee are not deleted automatically.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="council-outline"
            className="h-11 rounded-xl px-6"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-xl px-6 shadow-sm"
            disabled={deleting || !employee}
            onClick={() => void handleDelete()}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete employee
              </>
            )}
          </Button>
        </div>
      </div>
    </EmployeeModalShell>
  );
}
