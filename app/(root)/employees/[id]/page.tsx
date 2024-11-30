"use client";

import React, { useEffect, useState } from "react";
import { fetchEmployeeById } from "@/lib/appwrite/appwrite";
import { useParams } from "next/navigation";
import EmployeeDetailsCard from "@/components/EmployeeDetailsCard";
import SkeletonEmployeeDetailsCard from "@/components/skeletons/SkeletonEmployeeDetailsCard";

const EmployeeDetails = () => {
  const params = useParams();
  const { id } = params;
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchEmployee = async () => {
        setLoading(true);
        try {
          const data = await fetchEmployeeById(id as string);
          setEmployee(data);
        } catch (error) {
          console.error("Error fetching employee details:", error);
        }
        setLoading(false);
      };

      fetchEmployee();
    }
  }, [id]);

  if (loading) {
    return <SkeletonEmployeeDetailsCard />;
  }

  if (!employee) {
    return <SkeletonEmployeeDetailsCard />;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <EmployeeDetailsCard employee={employee} />
    </div>
  );
};

export default EmployeeDetails;
