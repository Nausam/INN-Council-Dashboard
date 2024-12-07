"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";

interface LeaveRequestCardProps {
  requestId: string;
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  status: "Approved" | "Rejected" | "Pending";
  actionBy?: string;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

const statusClasses = {
  Approved: "text-green-600 bg-green-100",
  Rejected: "text-red-600 bg-red-100",
  Pending: "text-yellow-600 bg-yellow-100",
};

const statusIcons = {
  Approved: <CheckCircleIcon className="h-6 w-6 text-green-600" />,
  Rejected: <XCircleIcon className="h-6 w-6 text-red-600" />,
  Pending: <ClockIcon className="h-6 w-6 text-yellow-600" />,
};

const AdminLeaveRequestCard: React.FC<LeaveRequestCardProps> = ({
  requestId,
  fullName,
  leaveType,
  reason,
  totalDays,
  startDate,
  endDate,
  status,
  actionBy,
  onApprove,
  onReject,
}) => {
  return (
    <div
      className={`rounded-lg shadow-lg border ${
        status === "Approved"
          ? "border-green-300"
          : status === "Rejected"
          ? "border-red-300"
          : "border-yellow-300"
      } bg-gradient-to-br from-white via-gray-50 ${
        status === "Approved"
          ? "to-green-50"
          : status === "Rejected"
          ? "to-red-50"
          : "to-yellow-50"
      } p-6 transition-all duration-200 hover:shadow-xl`}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{leaveType}</h3>
          <p className="font-extralight text-md">{fullName}</p>
        </div>
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
      <div className="mt-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Reason:</span> {reason}
        </p>
      </div>
      <div className="mt-6 space-y-2 text-sm">
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
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">Total Days:</span>
            <br />
            {totalDays}
          </p>
        </div>
      </div>
      <div className="flex mt-6 justify-end">
        {(actionBy && status === "Approved") || status === "Rejected" ? (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">
              {status === "Approved" ? "Approved By:" : "Rejected By:"}
            </span>{" "}
            {actionBy}
          </p>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => onApprove(requestId)}
              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow hover:bg-green-600 transition"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(requestId)}
              className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg shadow hover:bg-red-600 transition"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeaveRequestCard;
