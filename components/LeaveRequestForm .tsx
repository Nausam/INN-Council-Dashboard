"use client";

import React, { useState, useEffect } from "react";

interface LeaveRequestFormProps {
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
  const [formData, setFormData] = useState({
    fullName: "",
    reason: "",
    totalDays: 0,
    startDate: "",
    endDate: "",
    leaveType: "",
  });

  useEffect(() => {
    if (currentUser) {
      // Pre-populate full name
      setFormData((prev) => ({ ...prev, fullName: currentUser.fullName }));
    }
  }, [currentUser]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "totalDays" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);

    // Reset form fields after submission
    setFormData({
      fullName: currentUser?.fullName || "",
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
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none bg-gray-100 cursor-not-allowed"
          readOnly // Make this field read-only
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

      {/* Reason for Leave */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-700"
        >
          Reason for Leave
        </label>
        <textarea
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
          type="number"
          name="totalDays"
          value={formData.totalDays || ""}
          onChange={handleInputChange}
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          required
          min="1"
        />
      </div>

      {/* Leave Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700"
          >
            Leave Start Date
          </label>
          <input
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
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            required
          />
        </div>
      </div>

      {/* Submit Button */}
      <button type="submit" className="custom-button w-full h-12">
        Submit Request
      </button>
    </form>
  );
};

export default LeaveRequestForm;
