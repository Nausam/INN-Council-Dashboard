"use client";

import EmployeeCard from "@/components/EmployeeCard";
import { EmployeeDeleteConfirmModal } from "@/components/Modals/EmployeeDeleteConfirmModal";
import { EmployeeDetailsModal } from "@/components/Modals/EmployeeDetailsModal";
import { EmployeeEditModal } from "@/components/Modals/EmployeeEditModal";
import {
  DESIGNATION_OPTIONS,
  SECTION_OPTIONS,
} from "@/lib/employees/field-options";
import type { SlimEmployee } from "@/lib/firebase/types";
import { useMemo, useState } from "react";
import { Search, Users, Filter } from "lucide-react";

type Employee = {
  $id: string;
  name: string;
  designation: string;
  section: string;
};

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

function toEmployee(doc: SlimEmployee): Employee {
  return {
    $id: doc.$id,
    name: doc.name || "Unknown",
    designation: doc.designation || "",
    section: doc.section || "",
  };
}

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

export function EmployeesPageView({ employees }: { employees: SlimEmployee[] }) {
  const [selectedDesignation, setSelectedDesignation] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsEmployee, setDetailsEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);

  const normalized = useMemo(
    () => sortEmployeesByOrder(employees.map(toEmployee)),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    let filtered = normalized;
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
  }, [normalized, selectedDesignation, selectedSection, searchQuery]);

  const resetFilters = () => {
    setSelectedDesignation("All");
    setSelectedSection("All");
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
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
                {filteredEmployees.length}{" "}
                {filteredEmployees.length === 1 ? "employee" : "employees"}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, designation, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedDesignation}
                  onChange={(e) => setSelectedDesignation(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="All">All Designations</option>
                  {DESIGNATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="All">All Sections</option>
                  {SECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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

        {filteredEmployees.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((e) => (
              <EmployeeCard
                key={e.$id}
                name={e.name}
                designation={e.designation}
                section={e.section}
                employeeId={e.$id}
                onClick={() => setDetailsEmployee(e)}
                onEditClick={() => setEditEmployee(e)}
                onDeleteClick={() => setDeleteEmployee(e)}
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

      <EmployeeDetailsModal
        employeeId={detailsEmployee?.$id ?? null}
        open={detailsEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsEmployee(null);
        }}
        preview={
          detailsEmployee
            ? {
                name: detailsEmployee.name,
                designation: detailsEmployee.designation,
                section: detailsEmployee.section,
              }
            : undefined
        }
      />
      <EmployeeEditModal
        employeeId={editEmployee?.$id ?? null}
        open={editEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setEditEmployee(null);
        }}
        previewName={editEmployee?.name}
      />
      <EmployeeDeleteConfirmModal
        employee={deleteEmployee}
        open={deleteEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteEmployee(null);
        }}
        onDeleted={(employeeId) => {
          if (detailsEmployee?.$id === employeeId) setDetailsEmployee(null);
          if (editEmployee?.$id === employeeId) setEditEmployee(null);
          setDeleteEmployee(null);
        }}
      />
    </div>
  );
}
