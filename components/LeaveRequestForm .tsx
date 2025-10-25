"use client";

import React, { useEffect, useState } from "react";

type FormData = {
  fullName: string;
  reason: string;
  totalDays: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: string;
};

type CurrentUser = { fullName: string } | null;

interface LeaveRequestFormProps {
  onSubmit: (formData: FormData) => void;
  currentUser: CurrentUser;
}

const leaveTypes = [
  "Sick Leave",
  "Certificate Leave",
  "Annual Leave",
  "Family Related Leave",
  "Pre-Maternity Leave",
  "Maternity Leave",
  "Paternity Leave",
  "No Pay Leave",
  "Official Leave",
];

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
  onSubmit,
  currentUser,
}) => {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    reason: "",
    totalDays: 0,
    startDate: "",
    endDate: "",
    leaveType: "",
  });

  useEffect(() => {
    if (currentUser?.fullName) {
      setFormData((prev) => ({ ...prev, fullName: currentUser.fullName }));
    }
  }, [currentUser]);

  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const key = name as keyof FormData;

    setFormData((prev) => {
      if (key === "totalDays") {
        const parsed = Number(value);
        return { ...prev, totalDays: Number.isFinite(parsed) ? parsed : 0 };
      }
      return { ...prev, [key]: value } as FormData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Minimal validation
    if (!formData.leaveType) return;
    if (!formData.startDate || !formData.endDate) return;
    if (new Date(formData.endDate) < new Date(formData.startDate)) return;
    if (formData.totalDays <= 0) return;

    onSubmit(formData);

    // Reset form (keep user's name prefilled)
    setFormData({
      fullName: currentUser?.fullName ?? "",
      reason: "",
      totalDays: 0,
      startDate: "",
      endDate: "",
      leaveType: "",
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg w-full p-6 bg-white rounded-lg space-y-6"
    >
      {/* Full Name */}
      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-gray-700"
        >
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none bg-gray-100 cursor-not-allowed"
          readOnly
        />
      </div>

      {/* Leave Type */}
      <div>
        <label
          htmlFor="leaveType"
          className="block text-sm font-medium text-gray-700"
        >
          Leave Type
        </label>
        <select
          id="leaveType"
          name="leaveType"
          value={formData.leaveType}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          required
        >
          <option value="">Select Leave Type</option>
          {leaveTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-700"
        >
          Reason for Leave
        </label>
        <textarea
          id="reason"
          name="reason"
          value={formData.reason}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          rows={4}
          placeholder="Explain why you need the leave..."
          required
        />
      </div>

      {/* Total Days */}
      <div>
        <label
          htmlFor="totalDays"
          className="block text-sm font-medium text-gray-700"
        >
          Total Days for Leave
        </label>
        <input
          id="totalDays"
          type="number"
          name="totalDays"
          // let the field look empty when value is 0
          value={formData.totalDays === 0 ? "" : formData.totalDays}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          required
          min={1}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700"
          >
            Leave Start Date
          </label>
          <input
            id="startDate"
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleInputChange}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700"
          >
            Leave End Date
          </label>
          <input
            id="endDate"
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <button type="submit" className="custom-button w-full h-12">
        Submit Request
      </button>
    </form>
  );
};

export default LeaveRequestForm;
