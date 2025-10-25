"use client";

import EmployeeForm, { EmployeeFormData } from "@/components/EmployeeForm";
import {
  fetchEmployeeById,
  updateEmployeeRecord,
} from "@/lib/appwrite/appwrite";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Shape of what we expect back from Appwrite for an Employee document.
// Include only the fields you actually use on this page/form.
type EmployeeDoc = {
  $id: string;
  name: string;
  designation: string;
  joinedDate: string | null; // ISO in DB; we format to YYYY-MM-DD for the form
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
  // convert ISO -> YYYY-MM-DD (or empty)
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
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState<EmployeeFormData | null>(
    null
  );
  const employeeId = params.id;
  const router = useRouter();

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const emp = (await fetchEmployeeById(
          employeeId
        )) as unknown as EmployeeDoc;
        setEmployeeData(toFormValues(emp));
      } catch (error) {
        console.error("Error fetching employee:", error);
      }
    };
    fetchEmployee();
  }, [employeeId]);

  const handleUpdateEmployee = async (formData: EmployeeFormData) => {
    setLoading(true);
    try {
      await updateEmployeeRecord(employeeId, formData);
      alert("Employee updated successfully!");
      router.push("/employees");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  if (!employeeData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-2xl font-semibold">Loading...</p>
      </div>
    );
  }

  return (
    <EmployeeForm
      initialData={employeeData}
      onSubmit={handleUpdateEmployee}
      isLoading={loading}
    />
  );
};

export default EmployeeEditPage;
