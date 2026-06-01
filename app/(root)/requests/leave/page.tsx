"use client";

import React, { useEffect, useState } from "react";

import { createLeaveRequest } from "@/lib/firebase/hr";

import type { LeaveRequest } from "@/lib/firebase/types";
import LeaveRequestCard from "@/components/Leave/LeaveRequestCard";
import LeaveRequestModal from "@/components/Modals/LeaveRequestModal";
import Pagination from "@/components/shared/Pagination";
import ShowDropdown from "@/components/shared/ShowDropdown";
import SkeletonLeaveRequestCard from "@/components/skeletons/SkeletonLeaveRequestCard";
import {
  useQueryInvalidation,
  useUserLeaveRequestsQuery,
} from "@/hooks/queries";
import { getAuthProfile } from "@/lib/actions/user.actions";

/** Minimal shape you pass down to the modal (extend if you use more fields) */
type CurrentUser = {
  fullName?: string;
  email?: string;
  accountId?: string;
} | null;

const LeaveRequestPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(3);

  const offset = (currentPage - 1) * itemsPerPage;
  const { data, isLoading } = useUserLeaveRequestsQuery(
    "",
    itemsPerPage,
    offset,
  );
  const { invalidateLeaveRequests } = useQueryInvalidation();

  const allRequests = (data?.requests ?? []) as LeaveRequest[];
  const totalRequests = data?.totalCount ?? 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await getAuthProfile();
        setCurrentUser(
          user
            ? { fullName: user.fullName, email: user.email, accountId: user.id }
            : null,
        );
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchData();
  }, []);

  const handleFormSubmit = async (formData: {
    fullName: string;
    reason: string;
    totalDays: number;
    startDate: string;
    endDate: string;
    leaveType: string;
  }): Promise<void> => {
    try {
      await createLeaveRequest({
        fullName: formData.fullName,
        leaveType: formData.leaveType,
        reason: formData.reason,
        totalDays: formData.totalDays,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      setIsModalOpen(false);
      await invalidateLeaveRequests();
    } catch {
      alert("Failed to submit leave request. Please try again.");
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto p-6">
      {/* Header + trigger */}
      <div className="flex justify-between mt-10">
        <h2 className="text-3xl font-bold">Your Leave Requests</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="custom-button w-48 h-12"
        >
          Request Leave
        </button>
      </div>

      {/* Page size control */}
      <div className="flex w-full justify-end mt-4">
        <ShowDropdown
          label="Show:"
          options={[3, 6, 9]}
          value={itemsPerPage}
          onChange={(value) => setItemsPerPage(value)}
        />
      </div>

      {/* Modal */}
      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        currentUser={currentUser}
      />

      {/* List / skeletons */}
      <div className="max-w-7xl mx-auto p-4 mt-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonLeaveRequestCard key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRequests.map((request) => (
              <LeaveRequestCard
                key={request.$id}
                leaveType={request.leaveType}
                reason={request.reason}
                totalDays={request.totalDays}
                startDate={request.startDate}
                endDate={request.endDate}
                status={
                  request.approvalStatus as
                    | "Approved"
                    | "Rejected"
                    | "Pending"
                }
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-10 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalItems={totalRequests}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      </div>
    </section>
  );
};

export default LeaveRequestPage;
