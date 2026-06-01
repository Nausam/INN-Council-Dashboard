"use client";

import EmployeeForm, { EmployeeFormData } from "@/components/EmployeeForm";
import SkeletonEmployeeForm from "@/components/skeletons/SkeletonEmployeeForm";
import { PageShell } from "@/components/design-system";
import { useEmployeeQuery } from "@/hooks/queries";
import { updateEmployeeRecord } from "@/lib/firebase/hr";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type EmployeeDoc = {
  $id: string;
  name: string;
  designation: string;
  joinedDate: string | null;
  address: string;
  section: string;
  recordCardNumber: string;
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  officialLeave: number;
  noPayLeave: number;
  preMaternityLeave: number;
};

const toFormValues = (emp: EmployeeDoc): EmployeeFormData => ({
  name: emp.name ?? "",
  designation: emp.designation ?? "",
  joinedDate: emp.joinedDate
    ? new Date(emp.joinedDate).toISOString().split("T")[0]
    : "",
  address: emp.address ?? "",
  section: emp.section ?? "",
  recordCardNumber: emp.recordCardNumber ?? "",
  sickLeave: Number.isFinite(emp.sickLeave) ? emp.sickLeave : 0,
  certificateSickLeave: Number.isFinite(emp.certificateSickLeave)
    ? emp.certificateSickLeave
    : 0,
  annualLeave: Number.isFinite(emp.annualLeave) ? emp.annualLeave : 0,
  familyRelatedLeave: Number.isFinite(emp.familyRelatedLeave)
    ? emp.familyRelatedLeave
    : 0,
  maternityLeave: Number.isFinite(emp.maternityLeave) ? emp.maternityLeave : 0,
  paternityLeave: Number.isFinite(emp.paternityLeave) ? emp.paternityLeave : 0,
  officialLeave: Number.isFinite(emp.officialLeave) ? emp.officialLeave : 0,
  noPayLeave: Number.isFinite(emp.noPayLeave) ? emp.noPayLeave : 0,
  preMaternityLeave: Number.isFinite(emp.preMaternityLeave)
    ? emp.preMaternityLeave
    : 0,
});

const EmployeeEditPage = ({ params }: { params: { id: string } }) => {
  const [submitting, setSubmitting] = useState(false);
  const employeeId = params.id;
  const router = useRouter();

  const { data, isLoading } = useEmployeeQuery(employeeId);
  const employeeData = useMemo(
    () =>
      data ? toFormValues(data as unknown as EmployeeDoc) : null,
    [data],
  );

  const handleUpdateEmployee = async (formData: EmployeeFormData) => {
    setSubmitting(true);
    try {
      await updateEmployeeRecord(employeeId, formData);
      alert("Employee updated successfully!");
      router.push("/employees");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee.");
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
      initialData={employeeData}
      onSubmit={handleUpdateEmployee}
      isLoading={submitting}
    />
  );
};

export default EmployeeEditPage;
