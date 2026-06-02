"use client";

import AdminLeaveRequestCard from "@/components/Leave/AdminLeaveRequestCard";
import Pagination from "@/components/shared/Pagination";
import ShowDropdown from "@/components/shared/ShowDropdown";
import SkeletonAdminLeaveRequestCard from "@/components/skeletons/SkeletonAdminLeaveRequestCard";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import {
  useAdminLeaveRequestsQuery,
  useQueryInvalidation,
} from "@/hooks/queries";
import { updateLeaveRequest } from "@/lib/firebase/hr";
import React, { useState } from "react";

/* ---------- Types ---------- */

export type LeaveRequest = {
  $id: string;
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string; // ISO
  endDate: string; // ISO
  approvalStatus: "Approved" | "Rejected" | "Pending";
  actionBy?: string;
};

/* ---------- Component ---------- */

const AdminLeaveApprovalPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(4);

  const offset = (currentPage - 1) * itemsPerPage;
  const { data, isPending } = useAdminLeaveRequestsQuery(itemsPerPage, offset);
  const { invalidateLeaveRequests } = useQueryInvalidation();
  const { currentUser } = useCurrentUser();

  const leaveRequests = (data?.requests ?? []) as LeaveRequest[];
  const totalRequests = data?.totalCount ?? 0;

  const handleApproval = async (
    requestId: string,
    status: "Approved" | "Rejected",
  ): Promise<void> => {
    if (!currentUser?.fullName) {
      alert("Your user info is missing; cannot update this request.");
      return;
    }

    try {
      await updateLeaveRequest(requestId, {
        approvalStatus: status,
        actionBy: currentUser.fullName,
      });

      await invalidateLeaveRequests();
    } catch {
      alert("Failed to update leave request.");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-5 mt-10">
        <h1 className="text-3xl font-bold">Leave Requests</h1>

        <ShowDropdown
          label="Show:"
          options={[4, 6, 8]}
          value={itemsPerPage}
          onChange={(value) => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
        />
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mt-10">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonAdminLeaveRequestCard key={idx} />
          ))}
        </div>
      ) : leaveRequests.length === 0 ? (
        <p>No leave requests found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-4 mt-10">
          {leaveRequests.map((req) => (
            <AdminLeaveRequestCard
              key={req.$id}
              requestId={req.$id}
              fullName={req.fullName}
              leaveType={req.leaveType}
              reason={req.reason}
              totalDays={req.totalDays}
              startDate={req.startDate}
              endDate={req.endDate}
              status={req.approvalStatus}
              actionBy={req.actionBy}
              onApprove={(id) => handleApproval(id, "Approved")}
              onReject={(id) => handleApproval(id, "Rejected")}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Pagination
          currentPage={currentPage}
          totalItems={totalRequests}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>
    </div>
  );
};

export default AdminLeaveApprovalPage;
