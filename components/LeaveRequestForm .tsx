"use client";
import React, { useState } from "react";

interface LeaveRequestFormProps {
  onSubmit: (formData: {
    fullName: string;
    reason: string;
    totalDays: string;
    startDate: string;
    endDate: string;
    leaveType: string;
  }) => void;
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

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    reason: "",
    totalDays: "",
    startDate: "",
    endDate: "",
    leaveType: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      fullName: "",
      reason: "",
      totalDays: "",
      startDate: "",
      endDate: "",
      leaveType: "",
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl w-full p-6 bg-white rounded-lg shadow-lg"
    >
      <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
        Leave Request Form
      </h2>

      {/* Full Name */}
      <div className="mb-6">
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Full Name
        </label>
        <input
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
          required
        />
      </div>

      {/* Leave Type */}
      <div className="mb-6">
        <label
          htmlFor="leaveType"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Leave Type
        </label>
        <select
          name="leaveType"
          value={formData.leaveType}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
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
      <div className="mb-6">
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Reason for Leave
        </label>
        <textarea
          name="reason"
          value={formData.reason}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
          rows={4}
          required
        />
      </div>

      {/* Total Days */}
      <div className="mb-6">
        <label
          htmlFor="totalDays"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Total Days for Leave
        </label>
        <input
          type="number"
          name="totalDays"
          value={formData.totalDays}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
          required
          min="1"
        />
      </div>

      {/* Leave Start Date */}
      <div className="mb-6">
        <label
          htmlFor="startDate"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Leave Start Date
        </label>
        <input
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
          required
        />
      </div>

      {/* Leave End Date */}
      <div className="mb-6">
        <label
          htmlFor="endDate"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Leave End Date
        </label>
        <input
          type="date"
          name="endDate"
          value={formData.endDate}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-md focus:ring focus:ring-blue-500"
          required
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full py-3 text-white bg-blue-500 hover:bg-blue-600 rounded-md"
      >
        Submit Leave Request
      </button>
    </form>
  );
};

export default LeaveRequestForm;
