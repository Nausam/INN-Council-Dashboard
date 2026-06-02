"use client";

import EmployeeForm, { type EmployeeFormData } from "@/components/EmployeeForm";
import SkeletonEmployeeForm from "@/components/skeletons/SkeletonEmployeeForm";
import { PageShell } from "@/components/design-system";
import { useEmployeeQuery } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { updateEmployeeRecord } from "@/lib/firebase/hr";
import { employeeFormDataForFirestore } from "@/lib/employees/form-payload";
import { toEmployeeFormValues } from "@/lib/employees/transforms";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const EmployeeEditPage = ({ params }: { params: { id: string } }) => {
  const [submitting, setSubmitting] = useState(false);
  const employeeId = params.id;
  const router = useRouter();

  const { data, isLoading } = useEmployeeQuery(employeeId);
  const employeeData = useMemo(
    () => (data ? toEmployeeFormValues(data) : null),
    [data],
  );

  const handleUpdateEmployee = async (formData: EmployeeFormData) => {
    setSubmitting(true);
    try {
      await updateEmployeeRecord(employeeId, employeeFormDataForFirestore(formData));
      toast({
        title: "Success",
        description: `${formData.name} updated successfully`,
      });
      router.push("/employees");
    } catch (error) {
      console.error("Error updating employee:", error);
      toast({
        title: "Error",
        description: "Failed to update employee.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !employeeData) {
    return (
      <PageShell>
        <SkeletonEmployeeForm />
      </PageShell>
    );
  }

  return (
    <EmployeeForm
      key={`${employeeId}-${data?.$updatedAt ?? "loaded"}`}
      initialData={employeeData}
      onSubmit={handleUpdateEmployee}
      isLoading={submitting}
    />
  );
};

export default EmployeeEditPage;
