"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import SkeletonEmployeeDetailsCard from "@/components/skeletons/SkeletonEmployeeDetailsCard";
import { fetchEmployeeById } from "@/lib/appwrite/appwrite";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { ArrowLeft, User, Sparkles } from "lucide-react";

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
        {/* Decorative background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-indigo-100/30 blur-3xl" />
          <div className="absolute -right-48 top-96 h-96 w-96 rounded-full bg-violet-100/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-8 lg:px-8">
          {/* Back button skeleton */}
          <div className="mb-8 h-12 w-28 animate-pulse rounded-2xl bg-slate-200" />

          <SkeletonEmployeeDetailsCard />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Decorative background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-red-100/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-8 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="group mb-8 inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-slate-300 hover:bg-white hover:shadow-md"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            Back
          </button>

          {/* Error state */}
          <div
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-red-200 bg-gradient-to-br from-red-50 to-rose-50 py-20 px-6"
            style={{
              animation: "fadeInUp 400ms ease-out",
            }}
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 blur-2xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-2xl shadow-red-500/30">
                <User className="h-12 w-12" />
              </div>
            </div>
            <h3 className="mb-2 text-2xl font-black text-slate-900">
              Employee not found
            </h3>
            <p className="mb-6 text-center text-sm font-medium text-slate-600">
              The employee you&apos;re looking for doesn&apos;t exist or has
              been removed.
            </p>
            <button
              onClick={() => router.push("/employees")}
              className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              Back to Employees
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Decorative background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-indigo-100/30 blur-3xl" />
        <div className="absolute -right-48 top-96 h-96 w-96 rounded-full bg-violet-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="group mb-8 inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-slate-300 hover:bg-white hover:shadow-md"
          style={{
            animation: "fadeInLeft 400ms ease-out",
          }}
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Back
        </button>

        {/* Page header */}
        <div
          className="mb-8 flex items-center gap-5"
          style={{
            animation: "fadeInUp 400ms ease-out 100ms both",
          }}
        >
          {/* Icon Container */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 opacity-20 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-500/30">
              <User className="h-8 w-8" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              Employee Profile
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1 ring-1 ring-indigo-200/50">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-sm font-bold text-indigo-700">
                  {employee.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee details card */}
        <div
          style={{
            animation: "fadeInUp 400ms ease-out 200ms both",
          }}
        >
          <EmployeeDetailsCard employee={employee} />
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeDetails;
