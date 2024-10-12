"use client";
import React, { useState, useEffect } from "react";
import EmployeeCard from "@/components/EmployeeCard";
import { fetchAllEmployees } from "@/lib/appwrite";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");

  const router = useRouter();

  // Fetch all employees on component mount
  useEffect(() => {
    const getEmployees = async () => {
      try {
        const employeeData = await fetchAllEmployees();
        setEmployees(employeeData);
        setFilteredEmployees(employeeData); // Initially, show all employees
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
      setLoading(false);
    };

    getEmployees();
  }, []);

  const handleCardClick = (employeeId: string) => {
    router.push(`/employees/${employeeId}`);
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

  const applyFilters = (designation: string, section: string) => {
    let filtered = employees;

    if (designation !== "All") {
      filtered = filtered.filter(
        (employee) => employee.designation === designation
      );
    }

    if (section !== "All") {
      filtered = filtered.filter((employee) => employee.section === section);
    }

    setFilteredEmployees(filtered);
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between mb-10 items-center">
        <h1 className="text-3xl font-bold mb-6">Employees</h1>

        {/* Add Employee Button */}
        <Link
          href="/employees/add"
          className="border-2 border-gray-400 text-black font-semibold px-4 py-2 rounded-md flex items-center hover:border-cyan-600 transition duration-300"
        >
          <p>Add Employee</p>
        </Link>
      </div>

      <div className="flex gap-4 my-10">
        {/* Filter by Designation */}
        <select
          className="border-2 border-gray-400 rounded-md px-3 py-2"
          value={selectedDesignation}
          onChange={handleDesignationChange}
        >
          <option value="All">All Designations</option>
          <option value="Council President">Council President</option>
          <option value="Council Vice President">Council Vice President</option>
          <option value="Finance Officer">Finance Officer</option>
          <option value="Council Member">Council Member</option>
          <option value="Council Officer">Council Officer</option>
          <option value="A. Council Officer">A. Council Officer</option>
          <option value="Council Assistant">Council Assistant</option>
          <option value="Mosque Worker">Mosque Worker</option>
        </select>

        {/* Filter by Section */}
        <select
          className="border-2 border-gray-400 rounded-md px-3 py-2"
          value={selectedSection}
          onChange={handleSectionChange}
        >
          <option value="All">All Sections</option>
          <option value="Councillor">Councillor</option>
          <option value="Admin">Admin</option>
          <option value="Imam">Imam</option>
        </select>
      </div>

      {/* Display loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Show SkeletonCard components while loading */}
          {[...Array(15)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Map through filteredEmployees and display EmployeeCard */}
          {filteredEmployees.map((employee) => (
            <EmployeeCard
              key={employee.$id}
              name={employee.name}
              designation={employee.designation}
              employeeId={employee.$id}
              onClick={() => handleCardClick(employee.$id)}
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

const SkeletonCard = () => {
  return (
    <div className="shadow-md rounded-lg p-6 mt-2 cursor-pointer border animate-pulse">
      <div className="h-6 bg-gray-300 rounded mb-4 w-3/4"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
    </div>
  );
};
