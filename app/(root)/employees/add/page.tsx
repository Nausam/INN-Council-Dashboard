"use client";

import EmployeeForm, { EmployeeFormData } from "@/components/EmployeeForm";
import { EmptyState, PageShell } from "@/components/design-system";
import { employeeFormDataForFirestore } from "@/lib/employees/form-payload";
import { createEmployeeRecord } from "@/lib/firebase/hr";
import { useUser } from "@/Providers/UserProvider";
import { ShieldAlert } from "lucide-react";
import React, { useState } from "react";

const AddEmployeePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { isAdmin, loading: userLoading } = useUser();

  const handleCreateEmployee = async (formData: EmployeeFormData) => {
    setLoading(true);
    try {
      await createEmployeeRecord(employeeFormDataForFirestore(formData));
    } catch (error) {
      console.error("Error adding employee:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-8 w-56 rounded bg-slate-200" />
              <div className="h-4 w-72 rounded bg-slate-200" />
            </div>
          </div>
          <div className="council-card h-48" />
          <div className="council-card h-64" />
        </div>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg pt-12">
          <EmptyState
            icon={ShieldAlert}
            title="Access denied"
            description="You don't have permission to add employees. Contact an administrator if you need access."
          />
        </div>
      </PageShell>
    );
  }

  return (
    <EmployeeForm onSubmit={handleCreateEmployee} isLoading={loading} />
  );
};

export default AddEmployeePage;
