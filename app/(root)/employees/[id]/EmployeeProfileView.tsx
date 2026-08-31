"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import type { EmployeeDoc } from "@/lib/firebase/types";
import { ArrowLeft, User } from "lucide-react";
import { useRouter } from "next/navigation";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function EmployeeProfileView({ employee }: { employee: EmployeeDoc | null }) {
  const router = useRouter();
  const backButton = (
    <Button
      type="button"
      variant="council-outline"
      className="mb-6 h-11 rounded-xl px-4"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (!employee) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl">
          {backButton}
          <EmptyState
            icon={User}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
            action={
              <Button
                type="button"
                variant="council"
                className="rounded-xl"
                onClick={() => router.push("/employees")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Employees
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  const card = {
    name: str(employee.name),
    designation: str(employee.designation),
    sickLeave: num(employee.sickLeave),
    certificateSickLeave: num(employee.certificateSickLeave),
    annualLeave: num(employee.annualLeave),
    familyRelatedLeave: num(employee.familyRelatedLeave),
    preMaternityLeave: num(employee.preMaternityLeave),
    maternityLeave: num(employee.maternityLeave),
    paternityLeave: num(employee.paternityLeave),
    noPayLeave: num(employee.noPayLeave),
    officialLeave: num(employee.officialLeave),
    joinedDate: str(employee.joinedDate),
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        {backButton}
        <PageHeader
          icon={User}
          title="Employee Profile"
          subtitle={card.name}
          className="mb-8"
        />
        <EmployeeDetailsCard employee={card} />
      </div>
    </PageShell>
  );
}
