"use client";
import React, { useState, useEffect } from "react";
import EmployeeCard from "@/components/EmployeeCard";
import { fetchAllEmployees } from "@/lib/appwrite/appwrite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/user.actions";
import { useCurrentUser } from "@/hooks/getCurrentUser";

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");

  const { currentUser, loading: userLoading, isAdmin } = useCurrentUser();

  const router = useRouter();

  // List of employee names in the required order
  const employeeOrder = [
    "Ahmed Azmeen",
    "Ahmed Ruzaan",
    "Ibrahim Nuhan",
    "Aminath Samaha",
    "Aishath Samaha",
    "Imraan Shareef",
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
  ];

  // Fetch all employees on component mount
  useEffect(() => {
    const getEmployees = async () => {
      try {
        const employeeData = await fetchAllEmployees();
        const sortedData = sortEmployeesByOrder(employeeData);
        setEmployees(sortedData);
        setFilteredEmployees(sortedData); // Initially, show all employees
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
      setLoading(false);
    };

    getEmployees();
  }, []);

  // Sort employees based on the desired order
  const sortEmployeesByOrder = (employeesList: any[]) => {
    const employeeOrderMap = employeeOrder.reduce((acc, name, index) => {
      acc[name.toLowerCase()] = index;
      return acc;
    }, {} as Record<string, number>);

    return employeesList.sort((a, b) => {
      const indexA =
        employeeOrderMap[a.name.toLowerCase()] ?? employeeOrder.length;
      const indexB =
        employeeOrderMap[b.name.toLowerCase()] ?? employeeOrder.length;

      return indexA - indexB;
    });
  };

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

    // Sort the filtered employees according to the desired order
    setFilteredEmployees(sortEmployeesByOrder(filtered));
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
          <option value="Finance Officer">Finance Officer</option>
          <option value="Council Officer">Council Officer</option>
          <option value="A. Council Officer">A. Council Officer</option>
          <option value="Council Assistant">Council Assistant</option>
          <option value="Mosque Assistant">Mosque Assistant</option>
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
          <option value="Imam">Imam</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(20)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
