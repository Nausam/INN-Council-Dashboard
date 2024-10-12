"use client";
import React, { useState } from "react";
import { createEmployeeRecord } from "@/lib/appwrite";

const AddEmployeeForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    joinedDate: "",
    address: "",
    section: "",
    recordCardNumber: "",
    sickLeave: 0,
    certificateSickLeave: 0,
    annualLeave: 0,
    familyRelatedLeave: 0,
    maternityLeave: 0,
    paternityLeave: 0,
    officialLeave: 0,
    noPayLeave: 0,
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Convert numeric fields to integers
    const numericFields = [
      "sickLeave",
      "certificateSickLeave",
      "annualLeave",
      "familyRelatedLeave",
      "maternityLeave",
      "paternityLeave",
      "officialLeave",
      "noPayLeave",
    ];

    setFormData({
      ...formData,
      [name]: numericFields.includes(name) ? parseInt(value, 10) || 0 : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createEmployeeRecord(formData);
      alert("Employee added successfully!");
      setFormData({
        name: "",
        designation: "",
        joinedDate: "",
        address: "",
        section: "",
        recordCardNumber: "",
        sickLeave: 0,
        certificateSickLeave: 0,
        annualLeave: 0,
        familyRelatedLeave: 0,
        maternityLeave: 0,
        paternityLeave: 0,
        officialLeave: 0,
        noPayLeave: 0,
      });
    } catch (error) {
      console.error("Error adding employee:", error);
      alert("Failed to add employee. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Add Employee</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
        <div className="flex gap-2">
          {/* Name */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="name">
              Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            />
          </div>

          {/* Adress */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="name">
              Address
            </label>
            <input
              type="text"
              name="address"
              id="address"
              value={formData.address}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            />
          </div>

          {/* Designation */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="designation">
              Designation
            </label>
            <select
              name="designation"
              id="designation"
              value={formData.designation}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            >
              <option value="">Select Designation</option>
              <option value="Council President">Council President</option>
              <option value="Council Vice President">
                Council Vice President
              </option>
              <option value="Finance Officer">Finance Officer</option>
              <option value="Council Member">Council Member</option>
              <option value="Council Officer">Council Officer</option>
              <option value="A. Council Officer">A. Council Officer</option>
              <option value="Council Assistant">Council Assistant</option>
              <option value="Imam">Imam</option>
              <option value="Mosque Assistant">Mosque Assistant</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Section */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="designation">
              Section
            </label>
            <select
              name="section"
              id="section"
              value={formData.section}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            >
              <option value="">Select Section</option>
              <option value="Councillor">Councillor</option>
              <option value="Admin">Admin</option>
              <option value="Imam">Imam</option>
            </select>
          </div>

          {/* Record Card Number */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="sickLeave">
              Record Card Number
            </label>
            <input
              type="text"
              name="recordCardNumber"
              id="recordCardNumber"
              value={formData.recordCardNumber}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            />
          </div>

          {/* Joined Date */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="joinedDate">
              Joined Date
            </label>
            <input
              type="date"
              name="joinedDate"
              id="joinedDate"
              value={formData.joinedDate}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          {/* Sick Leave */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="sickLeave">
              Sick Leave
            </label>
            <input
              type="number"
              name="sickLeave"
              id="sickLeave"
              value={formData.sickLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>

          {/* Certificate Sick Leave */}
          <div className="w-full">
            <label
              className="block font-bold mb-2"
              htmlFor="certificateSickLeave"
            >
              Certificate Sick Leave
            </label>
            <input
              type="number"
              name="certificateSickLeave"
              id="certificateSickLeave"
              value={formData.certificateSickLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>

          {/* Annual Leave */}
          <div className="w-full">
            <label
              className="block font-bold mb-2"
              htmlFor="certificateSickLeave"
            >
              Annual Leave
            </label>
            <input
              type="number"
              name="annualLeave"
              id="annualLeave"
              value={formData.annualLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          {/* Family Related Leave */}
          <div className="w-full">
            <label
              className="block font-bold mb-2"
              htmlFor="familyRelatedLeave"
            >
              Family Related Leave
            </label>
            <input
              type="number"
              name="familyRelatedLeave"
              id="familyRelatedLeave"
              value={formData.familyRelatedLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>

          {/* Maternity Leave */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="maternityLeave">
              Maternity Leave
            </label>
            <input
              type="number"
              name="maternityLeave"
              id="maternityLeave"
              value={formData.maternityLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>

          {/* Paternity Leave */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="paternityLeave">
              Paternity Leave
            </label>
            <input
              type="number"
              name="paternityLeave"
              id="paternityLeave"
              value={formData.paternityLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          {/* Official Leave */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="officialLeave">
              Official Leave
            </label>
            <input
              type="number"
              name="officialLeave"
              id="officialLeave"
              value={formData.officialLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>

          {/* No Pay Leave */}
          <div className="w-full">
            <label className="block font-bold mb-2" htmlFor="noPayLeave">
              No Pay Leave
            </label>
            <input
              type="number"
              name="noPayLeave"
              id="noPayLeave"
              value={formData.noPayLeave}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              min="0"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Adding Employee..." : "Add Employee"}
        </button>
      </form>
    </div>
  );
};

export default AddEmployeeForm;
