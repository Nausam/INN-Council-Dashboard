"use client";

import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import SkeletonEmployeeDetailsCard from "@/components/skeletons/SkeletonEmployeeDetailsCard";
import { fetchEmployeeById } from "@/lib/appwrite/appwrite";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";

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
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [employee, setEmployee] = useState<EmployeeForCard | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      setLoading(true);
      try {
        const raw = await fetchEmployeeById(id);
        setEmployee(toEmployeeForCard(raw));
      } catch (err) {
        console.error("Error fetching employee details:", err);
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  if (loading || !employee) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <SkeletonEmployeeDetailsCard />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center max-w-7xl mx-auto p-8 h-screen w-full">
      <EmployeeDetailsCard employee={employee} />
    </div>
  );
};

export default EmployeeDetails;
