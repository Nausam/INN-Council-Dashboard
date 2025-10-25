"use client";

import React, { useEffect, useState } from "react";

import {
  createLeaveRequest,
  fetchUserLeaveRequests,
} from "@/lib/appwrite/appwrite";

import type { Models } from "node-appwrite";

import LeaveRequestCard from "@/components/Leave/LeaveRequestCard";
import LeaveRequestModal from "@/components/Modals/LeaveRequestModal";
import Pagination from "@/components/shared/Pagination";
import ShowDropdown from "@/components/shared/ShowDropdown";
import SkeletonLeaveRequestCard from "@/components/skeletons/SkeletonLeaveRequestCard";
import { getCurrentUser } from "@/lib/actions/user.actions";

/** Document shape returned from your leave-requests collection */
type LeaveRequest = Models.Document & {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string; // ISO
  endDate: string; // ISO
  approvalStatus: "Approved" | "Rejected" | "Pending";
  actionBy?: string;
};

/** Minimal shape you pass down to the modal (extend if you use more fields) */
type CurrentUser = {
  fullName?: string;
  email?: string;
  accountId?: string;
} | null;

const LeaveRequestPage: React.FC = () => {
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(3);
  const [totalRequests, setTotalRequests] = useState<number>(0);

  const fetchRequests = async (page = 1): Promise<void> => {
    setLoading(true);
    const offset = (page - 1) * itemsPerPage;

    try {
      const { requests, totalCount } = await fetchUserLeaveRequests(
        "", // no status filter
        itemsPerPage,
        offset
      );
      // requests already typed in appwrite helper
      setAllRequests(requests as LeaveRequest[]);
      setTotalRequests(totalCount);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user as CurrentUser);
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchRequests(currentPage);
    fetchData();
    // re-run when page or page size changes
  }, [currentPage, itemsPerPage]);

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
      setLoading(true);
      await fetchRequests(currentPage);
    } catch {
      alert("Failed to submit leave request. Please try again.");
    } finally {
      setLoading(false);
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
        {loading ? (
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
                status={request.approvalStatus}
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
