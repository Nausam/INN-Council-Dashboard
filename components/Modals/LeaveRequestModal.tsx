"use client";

import LeaveRequestForm from "../LeaveRequestForm ";

type LeaveFormData = {
  fullName: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  leaveType: string;
};

type CurrentUser = {
  fullName?: string;
  email?: string;
  $id?: string;
} | null;

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: LeaveFormData) => void;
  currentUser?: CurrentUser;
}

function LeaveRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}: LeaveRequestModalProps) {
  if (!isOpen) return null;

  // Normalize to exactly what the form expects (avoid excess/optional prop issues)
  const currentUserForForm = currentUser
    ? { fullName: currentUser.fullName ?? "" }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="mx-4 w-full max-w-xl rounded-lg bg-white p-6 shadow-lg md:mx-auto">
        <h2 className="mb-4 text-center text-2xl font-semibold text-gray-800">
          Request for Leave
        </h2>

        <LeaveRequestForm
          onSubmit={onSubmit}
          currentUser={currentUserForForm}
        />

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="close-button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveRequestModal;
