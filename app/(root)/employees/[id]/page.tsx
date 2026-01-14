"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import SkeletonEmployeeDetailsCard from "@/components/skeletons/SkeletonEmployeeDetailsCard";
import { fetchEmployeeById } from "@/lib/appwrite/appwrite";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
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

/** Map raw DB doc into the exact shape EmployeeDetailsCard needs */
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

  const [employee, setEmployee] = useState<EmployeeForCard | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const raw = await fetchEmployeeById(id);
        setEmployee(toEmployeeForCard(raw));
      } catch (err) {
        console.error("Error fetching employee details:", err);
        setEmployee(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          {/* Back button skeleton */}
          <div className="mb-8 h-10 w-32 animate-pulse rounded-xl bg-slate-200" />

          <SkeletonEmployeeDetailsCard />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {/* Error state */}
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
              <User className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              Employee not found
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              The employee you&apos;re looking for doesn&apos;t exist or has
              been removed.
            </p>
            <button
              onClick={() => router.push("/employees")}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
            >
              Back to Employees
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Page header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Employee Details
            </h1>
            <p className="mt-1 text-slate-600">
              Viewing profile for {employee.name}
            </p>
          </div>
        </div>

        {/* Employee details card */}
        <EmployeeDetailsCard employee={employee} />
      </div>
    </div>
  );
};

export default EmployeeDetails;
