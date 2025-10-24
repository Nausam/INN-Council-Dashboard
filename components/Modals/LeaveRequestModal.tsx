"use client";

import React from "react";
import LeaveRequestForm from "@/components/LeaveRequestForm ";

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    fullName: string;
    reason: string;
    totalDays: number;
    startDate: string;
    endDate: string;
    leaveType: string;
  }) => void;
  currentUser: any | null;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl mx-4 md:mx-auto p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
          Request for Leave
        </h2>
        {/* LeaveRequestForm Component */}
        <LeaveRequestForm onSubmit={onSubmit} currentUser={currentUser} />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="close-button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestModal;
