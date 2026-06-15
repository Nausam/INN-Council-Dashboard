"use client";

import type { OvertimeRequestEmployee } from "@/lib/firebase/types";
import { formatCouncilTimeDisplay } from "@/components/design-system";
import React from "react";

interface AdminOvertimeRequestCardProps {
  requestId: string;
  details: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  employees: OvertimeRequestEmployee[];
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

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

const AdminOvertimeRequestCard: React.FC<AdminOvertimeRequestCardProps> = ({
  requestId,
  details,
  startTime,
  endTime,
  durationMinutes,
  employees,
  status,
  actionBy,
  onApprove,
  onReject,
}) => {
  const employeeSummary =
    employees.length === 1
      ? employees[0]?.name
      : `${employees.length} employees`;

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
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-gray-800">Overtime</h3>
          <p className="font-extralight text-md truncate">{employeeSummary}</p>
        </div>
        <span
          className={`shrink-0 border ${
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
          <span className="font-semibold text-gray-800">Details:</span>{" "}
          {details}
        </p>
      </div>

      <div className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">Start:</span>
            <br />
            {formatCouncilTimeDisplay(startTime)}
          </p>
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">End:</span>
            <br />
            {formatCouncilTimeDisplay(endTime)}
          </p>
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">Duration:</span>
            <br />
            {formatDuration(durationMinutes)}
          </p>
        </div>
      </div>

      {employees.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200/80 bg-white/70 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Employees
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {employees.map((emp) => (
              <li key={emp.employeeId} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <span className="font-semibold text-gray-900">{emp.name}</span>
                {emp.designation && (
                  <span className="text-gray-500"> · {emp.designation}</span>
                )}
                {emp.recordCardNumber && (
                  <span className="block text-xs text-gray-500">
                    {emp.recordCardLabel ?? "Record Card No"}:{" "}
                    {emp.recordCardNumber}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
              type="button"
              onClick={() => onApprove(requestId)}
              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow hover:bg-green-600 transition"
            >
              Approve
            </button>
            <button
              type="button"
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

export default AdminOvertimeRequestCard;
