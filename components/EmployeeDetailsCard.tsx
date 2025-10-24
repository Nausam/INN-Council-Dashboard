"use client";

import React from "react";

interface EmployeeDetailsCardProps {
  employee: {
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
}

const EmployeeDetailsCard: React.FC<EmployeeDetailsCardProps> = ({
  employee,
}) => {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl shadow-lg p-8 w-full max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center gap-8 pb-6 border-b border-gray-200">
        <div className="w-24 h-24 bg-blue-100 flex items-center justify-center rounded-full shadow-md">
          <span className="text-blue-600 text-5xl font-black">
            {employee.name.split(" ").pop()?.charAt(0) || ""}
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-gray-800">
            {employee.name}
          </h2>
          <p className="text-lg text-gray-500">{employee.designation}</p>
          <p className="text-sm text-gray-400 mt-1">
            Joined:{" "}
            {new Date(employee.joinedDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Leave Details */}
      <div className="mt-8">
        <h3 className="text-2xl font-bold text-gray-700 mb-4">Leave Balance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { label: "Sick Leave", value: employee.sickLeave },
            {
              label: "Certificate Leave",
              value: employee.certificateSickLeave,
            },
            { label: "Annual Leave", value: employee.annualLeave },
            { label: "Family Leave", value: employee.familyRelatedLeave },
            { label: "Pre-Maternity", value: employee.preMaternityLeave },
            { label: "Maternity Leave", value: employee.maternityLeave },
            { label: "Paternity Leave", value: employee.paternityLeave },
            { label: "No Pay Leave", value: employee.noPayLeave },
            { label: "Official Leave", value: employee.officialLeave },
          ].map((leave, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 shadow-md hover:shadow-lg transition-shadow"
            >
              <p className="text-gray-600 font-medium">{leave.label}</p>
              <span className="text-lg font-bold text-gray-800">
                {leave.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsCard;
