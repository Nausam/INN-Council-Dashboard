"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";

export interface LeaveRequest {
  $id: string;
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  approvalStatus: "Pending" | "Approved" | "Rejected";
  actionBy?: string; // who took the action (optional)
}

interface LeaveRequestsTableProps {
  leaveRequests: LeaveRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  leaveRequests,
  onApprove,
  onReject,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Full Name</TableHead>
          <TableHead>Leave Type</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Total Days</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
          <TableHead>Action taken by</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {leaveRequests.map((request) => (
          <TableRow key={request.$id}>
            <TableCell>{request.fullName}</TableCell>
            <TableCell>{request.leaveType}</TableCell>
            <TableCell>{request.reason}</TableCell>
            <TableCell>{request.totalDays}</TableCell>

            <TableCell>
              {new Date(request.startDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </TableCell>

            <TableCell>
              {new Date(request.endDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </TableCell>

            <TableCell>
              <span
                className={`px-3 py-1 rounded ${
                  request.approvalStatus === "Approved"
                    ? "bg-green-100 text-green-600"
                    : request.approvalStatus === "Rejected"
                    ? "bg-red-100 text-red-600"
                    : "bg-yellow-100 text-yellow-600"
                }`}
              >
                {request.approvalStatus}
              </span>
            </TableCell>

            <TableCell>
              {request.approvalStatus === "Pending" ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => onApprove(request.$id)}
                    className="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(request.$id)}
                    className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </TableCell>

            <TableCell>{request.actionBy ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default LeaveRequestsTable;
