"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import SkeletonEmployeeDetailsCard from "@/components/skeletons/SkeletonEmployeeDetailsCard";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useEmployeeQuery } from "@/hooks/queries";
import { useParams, useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { ArrowLeft, User } from "lucide-react";

type EmployeeForCard = {
  name: string;
  designation: string;
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  preMaternityLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  noPayLeave: number;
  officialLeave: number;
  joinedDate: string;
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function toEmployeeForCard(raw: unknown): EmployeeForCard {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    name: str(r.name),
    designation: str(r.designation),
    sickLeave: num(r.sickLeave),
    certificateSickLeave: num(r.certificateSickLeave),
    annualLeave: num(r.annualLeave),
    familyRelatedLeave: num(r.familyRelatedLeave),
    preMaternityLeave: num(r.preMaternityLeave),
    maternityLeave: num(r.maternityLeave),
    paternityLeave: num(r.paternityLeave),
    noPayLeave: num(r.noPayLeave),
    officialLeave: num(r.officialLeave),
    joinedDate: str(r.joinedDate),
  };
}

const EmployeeDetails: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data, isPending, isError } = useEmployeeQuery(id);
  const employee = useMemo(
    () => (data ? toEmployeeForCard(data) : null),
    [data],
  );

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

  if (isPending && !employee) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl">
          {backButton}
          <div className="mb-8 flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
          <SkeletonEmployeeDetailsCard />
        </div>
      </PageShell>
    );
  }

  if (isError || !employee) {
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

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        {backButton}
        <PageHeader
          icon={User}
          title="Employee Profile"
          subtitle={employee.name}
          className="mb-8"
        />
        <EmployeeDetailsCard employee={employee} />
      </div>
    </PageShell>
  );
};

export default EmployeeDetails;
