"use client";

import EmployeeForm, { type EmployeeFormData } from "@/components/EmployeeForm";
import { EmployeeModalShell } from "@/components/Modals/EmployeeModalShell";
import { AvatarGlow } from "@/components/design-system";
import { useEmployeeQuery, useQueryInvalidation } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { updateEmployeeRecord } from "@/lib/firebase/hr";
import { toEmployeeFormValues } from "@/lib/employees/transforms";
import { Edit3, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

type EmployeeEditModalProps = {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewName?: string;
};

export function EmployeeEditModal({
  employeeId,
  open,
  onOpenChange,
  previewName,
}: EmployeeEditModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const { invalidateEmployees } = useQueryInvalidation();

  const { data, isPending } = useEmployeeQuery(
    open ? (employeeId ?? undefined) : undefined,
  );

  const formValues = useMemo(
    () => (data ? toEmployeeFormValues(data) : null),
    [data],
  );

  const displayName = formValues?.name ?? previewName ?? "Employee";

  const handleUpdate = async (formData: EmployeeFormData) => {
    if (!employeeId) return;
    setSubmitting(true);
    try {
      await updateEmployeeRecord(employeeId, formData);
      await invalidateEmployees(employeeId);
      toast({
        title: "Success",
        description: `${formData.name} updated successfully`,
      });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: `Failed to update ${formData.name}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmployeeModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Employee"
      description="Update employee information and leave balances"
      size="xl"
      header={
        <div className="flex items-start gap-4 pr-12">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
            <Edit3 className="h-6 w-6" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <AvatarGlow name={displayName} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">
                Edit {displayName}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-slate-600">
                Changes are saved to the employee record
              </p>
            </div>
          </div>
        </div>
      }
    >
      <div className="p-6 sm:p-8">
        {isPending && !formValues ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-slate-600">
              Loading employee…
            </p>
          </div>
        ) : formValues ? (
          <div className="animate-in fade-in duration-300 fill-mode-both">
            <EmployeeForm
              variant="modal"
              employeeId={employeeId ?? undefined}
              initialData={formValues}
              onSubmit={handleUpdate}
              isLoading={submitting}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Could not load employee
            </p>
          </div>
        )}
      </div>
    </EmployeeModalShell>
  );
}
