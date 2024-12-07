"use client";

import React from "react";

type CardProps = {
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  status: "Approved" | "Rejected" | "Pending";
};

const statusClasses: { [key in "Approved" | "Rejected" | "Pending"]: string } =
  {
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Pending: "bg-yellow-100 text-yellow-700",
  };

const Card: React.FC<CardProps> = ({
  leaveType,
  reason,
  totalDays,
  startDate,
  endDate,
  status,
}) => {
  return (
    <div
      className={`rounded-xl shadow-lg border ${
        status === "Approved"
          ? "border-green-300"
          : status === "Rejected"
          ? "border-red-300"
          : "border-yellow-300"
      } bg-gradient-to-r from-white ${
        status === "Approved"
          ? "to-green-400/10"
          : status === "Rejected"
          ? "to-red-400/10"
          : "to-yellow-400/10"
      } p-6 hover:shadow-xl transition-all duration-300`}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">{leaveType}</h3>
        <span
          className={`border ${
            status === "Approved"
              ? "border-green-300"
              : status === "Rejected"
              ? "border-red-300"
              : "border-yellow-300"
          } px-4 py-2 rounded-lg text-sm font-semibold shadow-md ${
            statusClasses[status]
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-4 text-gray-700 text-sm">
        <span className="font-medium text-gray-900">Reason:</span> {reason}
      </p>
      <div className="mt-6 flex flex-col gap-4 text-sm">
        <div className="flex justify-between">
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">Start Date:</span>
            <br />
            {new Date(startDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">End Date:</span>
            <br />
            {new Date(endDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Total Days:</span>{" "}
            {totalDays}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Card;
