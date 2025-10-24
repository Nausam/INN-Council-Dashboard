"use client";
import React, { useState } from "react";

import { createEmployeeRecord } from "@/lib/appwrite/appwrite";
import EmployeeForm from "@/components/EmployeeForm";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import { useUser } from "@/Providers/UserProvider";

const AddEmployeePage = () => {
  const [loading, setLoading] = useState(false);
  const { currentUser, isAdmin, loading: userLoading } = useUser();

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

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner-border animate-spin inline-block w-10 h-10 border-4 rounded-full border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-cyan-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isAdmin ? (
        <EmployeeForm onSubmit={handleCreateEmployee} isLoading={loading} />
      ) : (
        <div className="flex items-center justify-center h-screen shadow-md">
          <div className="text-center p-8 rounded-lg shadow-lg bg-red-500 text-white">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-lg">
              You don't have permission to
              <span className="font-semibold"> add employees</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddEmployeePage;
