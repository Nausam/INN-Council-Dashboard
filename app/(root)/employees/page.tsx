"use client";

import EmployeeCard from "@/components/EmployeeCard";
import SkeletonEmployeesPage from "@/components/skeletons/SkeletonEmployeesPage";
import { useEmployeesQuery } from "@/hooks/queries";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { Search, Users, Filter } from "lucide-react";

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

function sortEmployeesByOrder(list: Employee[]): Employee[] {
  const indexMap = employeeOrder.reduce<Record<string, number>>(
    (acc, name, idx) => {
      acc[name.toLowerCase()] = idx;
      return acc;
    },
    {},
  );

  return [...list].sort((a, b) => {
    const ia = indexMap[a.name.toLowerCase()] ?? employeeOrder.length;
    const ib = indexMap[b.name.toLowerCase()] ?? employeeOrder.length;
    return ia - ib;
  });
}

/* ===== Page ===== */

const EmployeesPage: React.FC = () => {
  const [selectedDesignation, setSelectedDesignation] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: rawEmployees, isLoading } = useEmployeesQuery();
  const router = useRouter();

  const employees = useMemo(() => {
    const normalized: Employee[] = (Array.isArray(rawEmployees) ? rawEmployees : [])
      .map(toEmployee)
      .filter((e): e is Employee => e !== null);

    return sortEmployeesByOrder(normalized);
  }, [rawEmployees]);

  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (selectedDesignation !== "All") {
      filtered = filtered.filter((e) => e.designation === selectedDesignation);
    }
    if (selectedSection !== "All") {
      filtered = filtered.filter((e) => e.section === selectedSection);
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.designation.toLowerCase().includes(query) ||
          e.section.toLowerCase().includes(query),
      );
    }

    return sortEmployeesByOrder(filtered);
  }, [employees, selectedDesignation, selectedSection, searchQuery]);

  const handleCardClick = (employeeId: string) => {
    router.push(`/employees/${employeeId}`);
  };

  const handleDesignationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDesignation(e.target.value);
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSection(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const resetFilters = () => {
    setSelectedDesignation("All");
    setSelectedSection("All");
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <SkeletonEmployeesPage />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Header Section */}
        <div className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Employees
              </h1>
              <p className="mt-1 text-slate-600">
                {`${filteredEmployees.length} ${
                  filteredEmployees.length === 1 ? "employee" : "employees"
                }`}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, designation, or section..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              {/* Designation Filter */}
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedDesignation}
                  onChange={handleDesignationChange}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="All">All Designations</option>
                  <option value="Council President">Council President</option>
                  <option value="Council Vice President">
                    Council Vice President
                  </option>
                  <option value="Council Member">Council Member</option>
                  <option value="Council Executive">Council Executive</option>
                  <option value="A. Council Executive">
                    A. Council Executive
                  </option>
                  <option value="Finance Officer">Finance Officer</option>
                  <option value="Council Officer">Council Officer</option>
                  <option value="A. Council Officer">A. Council Officer</option>
                  <option value="Council Assistant">Council Assistant</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Section Filter */}
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedSection}
                  onChange={handleSectionChange}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="All">All Sections</option>
                  <option value="Councillor">Councillor</option>
                  <option value="Admin">Admin</option>
                  <option value="Mosque">Mosque</option>
                  <option value="Waste Management">Waste Management</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Reset Button */}
            {(selectedDesignation !== "All" ||
              selectedSection !== "All" ||
              searchQuery !== "") && (
              <button
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Employee Grid */}
        {filteredEmployees.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((e) => (
              <EmployeeCard
                key={e.$id}
                name={e.name}
                designation={e.designation}
                section={e.section}
                employeeId={e.$id}
                onClick={() => handleCardClick(e.$id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              No employees found
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              Try adjusting your search or filters
            </p>
            <button
              onClick={resetFilters}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeesPage;
