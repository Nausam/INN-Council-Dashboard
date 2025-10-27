"use client";

import EmployeeCard from "@/components/EmployeeCard";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import { fetchAllEmployees } from "@/lib/appwrite/appwrite";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

/* ===== Types & helpers ===== */

type Employee = {
  $id: string;
  name: string;
  designation: string;
  section: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toEmployee(doc: unknown): Employee | null {
  if (!isRecord(doc)) return null;

  const id =
    (typeof doc.$id === "string" && doc.$id) ||
    (typeof doc.id === "string" && doc.id);
  if (!id) return null;

  const name = (typeof doc.name === "string" && doc.name) || "Unknown";

  const designation =
    (typeof doc.designation === "string" && doc.designation) || "";

  const section = (typeof doc.section === "string" && doc.section) || "";

  return { $id: id, name, designation, section };
}

/* ===== Page ===== */

const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");

  const { currentUser, loading: userLoading, isAdmin } = useCurrentUser(); // kept in case you use it elsewhere
  const router = useRouter();

  // Fixed order
  const employeeOrder = [
    "Ahmed Azmeen",
    "Ahmed Ruzaan",
    "Ibrahim Nuhan",
    "Aminath Samaha",
    "Aishath Samaha",
    "Imran Shareef",
    "Aminath Shazuly",
    "Fazeel Ahmed",
    "Hussain Sazeen",
    "Mohamed Suhail",
    "Aminath Shaliya",
    "Fathimath Jazlee",
    "Aminath Nuha",
    "Hussain Nausam",
    "Fathimath Zeyba",
    "Fathimath Usaira",
    "Mohamed Waheedh",
    "Aishath Shaila",
    "Azlifa Saleem",
    "Aishath Shabaana",
    "Aishath Naahidha",
    "Aishath Simaana",
    "Fazeela Naseer",
    "Buruhan",
    "Ubaidh",
  ];

  // Sort employees based on the desired order
  function sortEmployeesByOrder(list: Employee[]): Employee[] {
    const indexMap = employeeOrder.reduce<Record<string, number>>(
      (acc, name, idx) => {
        acc[name.toLowerCase()] = idx;
        return acc;
      },
      {}
    );

    return [...list].sort((a, b) => {
      const ia = indexMap[a.name.toLowerCase()] ?? employeeOrder.length;
      const ib = indexMap[b.name.toLowerCase()] ?? employeeOrder.length;
      return ia - ib;
    });
  }

  // Fetch all employees on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const raw = await fetchAllEmployees();
        const normalized: Employee[] = (Array.isArray(raw) ? raw : [])
          .map(toEmployee)
          .filter((e): e is Employee => e !== null);

        const sorted = sortEmployeesByOrder(normalized);
        setEmployees(sorted);
        setFilteredEmployees(sorted);
      } catch (err) {
        console.error("Error fetching employees:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCardClick = (employeeId: string) => {
    router.push(`/employees/${employeeId}`);
  };

  const applyFilters = (designation: string, section: string) => {
    let filtered = employees;

    if (designation !== "All") {
      filtered = filtered.filter((e) => e.designation === designation);
    }
    if (section !== "All") {
      filtered = filtered.filter((e) => e.section === section);
    }

    setFilteredEmployees(sortEmployeesByOrder(filtered));
  };

  const handleDesignationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const designation = e.target.value;
    setSelectedDesignation(designation);
    applyFilters(designation, selectedSection);
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const section = e.target.value;
    setSelectedSection(section);
    applyFilters(selectedDesignation, section);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-8">
      <div className="flex justify-between mb-10 items-center">
        <h1 className="text-3xl font-bold mb-5 mt-10">Employees</h1>
      </div>

      <div className="flex md:flex-row flex-col gap-4 my-10">
        {/* Filter by Designation */}
        <select
          className="border p-2 rounded-md w-full h-12"
          value={selectedDesignation}
          onChange={handleDesignationChange}
        >
          <option value="All">All Designations</option>
          <option value="Council President">Council President</option>
          <option value="Council Vice President">Council Vice President</option>
          <option value="Council Member">Council Member</option>
          <option value="Council Executive">Council Executive</option>
          <option value="A. Council Executive">A. Council Executive</option>
          <option value="Finance Officer">Finance Officer</option>
          <option value="Council Officer">Council Officer</option>
          <option value="A. Council Officer">A. Council Officer</option>
          <option value="Council Assistant">Council Assistant</option>
        </select>

        {/* Filter by Section */}
        <select
          className="border p-2 rounded-md w-full h-12"
          value={selectedSection}
          onChange={handleSectionChange}
        >
          <option value="All">All Sections</option>
          <option value="Councillor">Councillor</option>
          <option value="Admin">Admin</option>
          <option value="Mosque">Mosque</option>
          <option value="Waste Management">Waste Management</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((e) => (
            <EmployeeCard
              key={e.$id}
              name={e.name}
              designation={e.designation}
              employeeId={e.$id}
              onClick={() => handleCardClick(e.$id)}
            />
          ))}
        </div>
      ) : (
        <p>No employees found.</p>
      )}
    </div>
  );
};

export default EmployeesPage;

const SkeletonCard: React.FC = () => (
  <div className="shadow-md rounded-lg p-6 mt-2 cursor-pointer border animate-pulse">
    <div className="h-6 bg-gray-300 rounded mb-4 w-3/4" />
    <div className="h-4 bg-gray-300 rounded w-1/2" />
  </div>
);
