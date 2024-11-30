"use client";
import React, { useState } from "react";

import { createEmployeeRecord } from "@/lib/appwrite/appwrite";
import EmployeeForm from "@/components/EmployeeForm";

const AddEmployeePage = () => {
  const [loading, setLoading] = useState(false);

  const handleCreateEmployee = async (formData: any) => {
    setLoading(true);
    try {
      await createEmployeeRecord(formData);
      alert("Employee added successfully!");
    } catch (error) {
      console.error("Error adding employee:", error);
      alert("Failed to add employee.");
    }
    setLoading(false);
  };

  return <EmployeeForm onSubmit={handleCreateEmployee} isLoading={loading} />;
};

export default AddEmployeePage;
