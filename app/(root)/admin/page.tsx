"use client";

import AdminLeaveRequestCard from "@/components/Leave/AdminLeaveRequestCard";
import { HolidayCalendarPanel } from "@/components/admin/HolidayCalendarPanel";
import { ZkDevicePanel } from "@/components/admin/ZkDevicePanel";
import AdminOvertimeRequestCard from "@/components/overtime/AdminOvertimeRequestCard";
import Pagination from "@/components/shared/Pagination";
import ShowDropdown from "@/components/shared/ShowDropdown";
import SkeletonAdminLeaveRequestCard from "@/components/skeletons/SkeletonAdminLeaveRequestCard";
import SkeletonAdminOvertimeRequestCard from "@/components/skeletons/SkeletonAdminOvertimeRequestCard";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import {
  useAdminLeaveRequestsQuery,
  useAdminOvertimeRequestsQuery,
  useQueryInvalidation,
} from "@/hooks/queries";
import {
  updateLeaveRequest,
  updateOvertimeRequest,
} from "@/lib/firebase/hr";
import type { LeaveRequest, OvertimeRequest } from "@/lib/firebase/types";
import React, { useState } from "react";

const AdminLeaveApprovalPage: React.FC = () => {
  const [leavePage, setLeavePage] = useState<number>(1);
  const [leavePerPage, setLeavePerPage] = useState<number>(4);
  const [otPage, setOtPage] = useState<number>(1);
  const [otPerPage, setOtPerPage] = useState<number>(4);

  const leaveOffset = (leavePage - 1) * leavePerPage;
  const otOffset = (otPage - 1) * otPerPage;

  const { data: leaveData, isPending: leavePending } =
    useAdminLeaveRequestsQuery(leavePerPage, leaveOffset);
  const { data: otData, isPending: otPending } = useAdminOvertimeRequestsQuery(
    otPerPage,
    otOffset,
  );

  const { invalidateLeaveRequests, invalidateOvertimeRequests } =
    useQueryInvalidation();
  const { currentUser } = useCurrentUser();

  const leaveRequests = (leaveData?.requests ?? []) as LeaveRequest[];
  const totalLeaveRequests = leaveData?.totalCount ?? 0;
  const overtimeRequests = (otData?.requests ?? []) as OvertimeRequest[];
  const totalOvertimeRequests = otData?.totalCount ?? 0;

  const handleLeaveApproval = async (
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

  const handleOvertimeApproval = async (
    requestId: string,
    status: "Approved" | "Rejected",
  ): Promise<void> => {
    if (!currentUser?.fullName) {
      alert("Your user info is missing; cannot update this request.");
      return;
    }

    try {
      await updateOvertimeRequest(requestId, {
        approvalStatus: status,
        actionBy: currentUser.fullName,
      });
      await invalidateOvertimeRequests();
    } catch {
      alert("Failed to update overtime request.");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <section className="mt-10">
        <HolidayCalendarPanel />
      </section>

      <section className="mt-10">
        <ZkDevicePanel />
      </section>

      <section>
        <div className="flex justify-between items-center mb-5 mt-10">
          <h1 className="text-3xl font-bold">Leave Requests</h1>
          <ShowDropdown
            label="Show:"
            options={[4, 6, 8]}
            value={leavePerPage}
            onChange={(value) => {
              setLeavePerPage(value);
              setLeavePage(1);
            }}
          />
        </div>

        {leavePending ? (
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
                status={req.approvalStatus as "Approved" | "Rejected" | "Pending"}
                actionBy={req.actionBy}
                onApprove={(id) => handleLeaveApproval(id, "Approved")}
                onReject={(id) => handleLeaveApproval(id, "Rejected")}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={leavePage}
            totalItems={totalLeaveRequests}
            itemsPerPage={leavePerPage}
            onPageChange={(page) => setLeavePage(page)}
          />
        </div>
      </section>

      <section className="mt-16">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-3xl font-bold">OT Requests</h1>
          <ShowDropdown
            label="Show:"
            options={[4, 6, 8]}
            value={otPerPage}
            onChange={(value) => {
              setOtPerPage(value);
              setOtPage(1);
            }}
          />
        </div>

        {otPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mt-10">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonAdminOvertimeRequestCard key={idx} />
            ))}
          </div>
        ) : overtimeRequests.length === 0 ? (
          <p>No overtime requests found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-4 mt-10">
            {overtimeRequests.map((req) => (
              <AdminOvertimeRequestCard
                key={req.$id}
                requestId={req.$id}
                details={req.details}
                startTime={req.startTime}
                endTime={req.endTime}
                durationMinutes={req.durationMinutes}
                employees={req.employees ?? []}
                status={
                  req.approvalStatus as "Approved" | "Rejected" | "Pending"
                }
                actionBy={req.actionBy}
                onApprove={(id) => handleOvertimeApproval(id, "Approved")}
                onReject={(id) => handleOvertimeApproval(id, "Rejected")}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={otPage}
            totalItems={totalOvertimeRequests}
            itemsPerPage={otPerPage}
            onPageChange={(page) => setOtPage(page)}
          />
        </div>
      </section>
    </div>
  );
};

export default AdminLeaveApprovalPage;
