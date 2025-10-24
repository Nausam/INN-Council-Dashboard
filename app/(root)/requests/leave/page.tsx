"use client";

import React, { useEffect, useState } from "react";

import {
  createLeaveRequest,
  fetchUserLeaveRequests,
} from "@/lib/appwrite/appwrite";

import { Models } from "node-appwrite";

import { getCurrentUser } from "@/lib/actions/user.actions";
import LeaveRequestCard from "@/components/Leave/LeaveRequestCard";
import SkeletonLeaveRequestCard from "@/components/skeletons/SkeletonLeaveRequestCard";
import LeaveRequestModal from "@/components/Modals/LeaveRequestModal";
import ShowDropdown from "@/components/shared/ShowDropdown";
import Pagination from "@/components/shared/Pagination";

type LeaveRequest = Models.Document & {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  approvalStatus: string;
};

const LeaveRequestPage = () => {
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const [totalRequests, setTotalRequests] = useState(0);

  const fetchRequests = async (page = 1) => {
    setLoading(true);
    const offset = (page - 1) * itemsPerPage;

    try {
      const { requests, totalCount } = await fetchUserLeaveRequests(
        "",
        itemsPerPage,
        offset
      );
      setAllRequests(requests);

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
        setCurrentUser(user);
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchRequests(currentPage);
    fetchData();
  }, [currentPage, itemsPerPage]);

  const handleFormSubmit = async (formData: {
    fullName: string;
    reason: string;
    totalDays: number;
    startDate: string;
    endDate: string;
    leaveType: string;
  }) => {
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
      // Refresh leave requests
      fetchRequests(currentPage);
    } catch (error) {
      alert("Failed to submit leave request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto p-6">
      {/* Leave Request Form */}
      <div className="flex justify-between mt-10">
        <h2 className="text-3xl font-bold">Your Leave Requests</h2>
        <button
          onClick={() => setIsModalOpen(true)} // Open the modal
          className="custom-button w-48 h-12"
        >
          Request Leave
        </button>
      </div>
      <div className="flex w-full justify-end mt-4">
        <ShowDropdown
          label="Show:"
          options={[3, 6, 9]}
          value={itemsPerPage}
          onChange={(value) => setItemsPerPage(value)}
        />
      </div>

      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        currentUser={currentUser}
      />

      {/* Items Per Page Selector */}

      <div className="max-w-7xl mx-auto p-4 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonLeaveRequestCard key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRequests.map((request, index) => (
              <LeaveRequestCard
                key={index}
                leaveType={request.leaveType}
                reason={request.reason}
                totalDays={request.totalDays}
                startDate={request.startDate}
                endDate={request.endDate}
                status={
                  request.approvalStatus as "Approved" | "Rejected" | "Pending"
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
