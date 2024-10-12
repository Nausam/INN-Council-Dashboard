"use client";
import React, { useState, useEffect } from "react";
import EmployeeForm from "@/components/EmployeeForm";
import { updateEmployeeRecord, fetchEmployeeById } from "@/lib/appwrite";
import { useRouter } from "next/navigation";

const EmployeeEditPage = ({ params }: { params: { id: string } }) => {
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const employeeId = params.id;
  const router = useRouter();

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const employee = await fetchEmployeeById(employeeId);
        setEmployeeData({
          ...employee,
          joinedDate: employee.joinedDate
            ? new Date(employee.joinedDate).toISOString().split("T")[0]
            : "", // Format the date
        });
      } catch (error) {
        console.error("Error fetching employee:", error);
      }
    };
    fetchEmployee();
  }, [employeeId]);

  const handleUpdateEmployee = async (formData: any) => {
    setLoading(true);
    try {
      await updateEmployeeRecord(employeeId, formData);
      alert("Employee updated successfully!");
      router.push("/employees");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee.");
    }
    setLoading(false);
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
