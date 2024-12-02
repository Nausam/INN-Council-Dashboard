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
    <div className="bg-white shadow-lg rounded-lg overflow-hidden p-6 max-w-md mx-auto mt-10 border">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{employee.name}</h2>
        <p className="text-gray-600">{employee.designation}</p>
      </div>

      <div className="mt-6 border-t pt-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Joined Date</h3>
        <p className="text-gray-700">
          {new Date(employee.joinedDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="mt-4 border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-800">Leave Details</h3>
        <ul className="mt-2 text-gray-700">
          <li className="flex justify-between bg-gray-100 p-2">
            <p>Sick Leave</p>
            <p>{employee.sickLeave}</p>
          </li>

          <li className="flex justify-between p-2">
            <p>Certificate Leave</p>
            <p>{employee.certificateSickLeave}</p>
          </li>

          <li className="flex justify-between bg-gray-100 p-2">
            <p>Annual Leave</p>
            <p>{employee.annualLeave}</p>
          </li>

          <li className="flex justify-between p-2">
            <p>Family Related Leave</p>
            <p>{employee.familyRelatedLeave}</p>
          </li>

          <li className="flex justify-between bg-gray-100 p-2 ">
            <p>Pre-Maternity Leave</p>
            <p>{employee.preMaternityLeave}</p>
          </li>

          <li className="flex justify-between  p-2 ">
            <p>Maternity Leave</p>
            <p>{employee.maternityLeave}</p>
          </li>

          <li className="flex justify-between bg-gray-100 p-2">
            <p>Paternity Leave</p>
            <p>{employee.paternityLeave}</p>
          </li>

          <li className="flex justify-between  p-2">
            <p>No Pay Leave</p>
            <p>{employee.noPayLeave}</p>
          </li>

          <li className="flex justify-between bg-gray-100 p-2">
            <p>Official Leave</p>
            <p>{employee.officialLeave}</p>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EmployeeDetailsCard;
