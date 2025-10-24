"use client";

import React, { useEffect, useState } from "react";
import {
  fetchLeaveRequests,
  updateLeaveRequest,
} from "@/lib/appwrite/appwrite";
import LeaveRequestsTable from "@/components/Leave/LeaveRequestTable";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import AdminLeaveRequestCard from "@/components/Leave/AdminLeaveRequestCard";
import SkeletonAdminLeaveRequestCard from "@/components/skeletons/SkeletonAdminLeaveRequestCard";
import { toast } from "@/hooks/use-toast";
import ShowDropdown from "@/components/shared/ShowDropdown";
import Pagination from "@/components/shared/Pagination";

const AdminLeaveApprovalPage = () => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useCurrentUser();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [totalRequests, setTotalRequests] = useState(0);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const { requests, totalCount } = await fetchLeaveRequests(
        itemsPerPage,
        offset
      );

      setLeaveRequests(requests);
      setTotalRequests(totalCount);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (
    requestId: string,
    status: "Approved" | "Rejected"
  ) => {
    if (!currentUser || !currentUser.fullName) {
      alert("Current user information is missing. Cannot update request.");
      return;
    }
    try {
      // Update the status of the leave request in the database
      await updateLeaveRequest(requestId, {
        approvalStatus: status,
        actionBy: currentUser.fullName,
      });

      // Update the status in the local state without refetching
      setLeaveRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.$id === requestId
            ? { ...request, approvalStatus: status }
            : request
        )
      );
      fetchRequests();
    } catch (error) {
      console.error("Error updating leave request:", error);
      alert("Failed to update leave request.");
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentPage, itemsPerPage]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-5 mt-10">
        <h1 className="text-3xl font-bold">Leave Requests</h1>

        {/* Items Per Page Dropdown */}
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
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mt-10">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonAdminLeaveRequestCard key={index} />
          ))}
        </div>
      ) : leaveRequests.length === 0 ? (
        <p>No leave requests found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-4 mt-10">
          {leaveRequests.map((request) => (
            <AdminLeaveRequestCard
              key={request.$id}
              requestId={request.$id}
              fullName={request.fullName}
              leaveType={request.leaveType}
              reason={request.reason}
              totalDays={request.totalDays}
              startDate={request.startDate}
              endDate={request.endDate}
              status={request.approvalStatus}
              actionBy={request.actionBy}
              onApprove={(id) => handleApproval(id, "Approved")}
              onReject={(id) => handleApproval(id, "Rejected")}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
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
