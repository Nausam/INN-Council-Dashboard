"use client";

import { toast } from "@/hooks/use-toast";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
} from "@/lib/appwrite/appwrite";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";

/* ---------------- Types ---------------- */

export type EmployeeFormData = {
  name: string;
  designation: string;
  joinedDate: string; // ISO date (yyyy-mm-dd)
  address: string;
  section: string;
  recordCardNumber: string;

  // leave balances
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  officialLeave: number;
  noPayLeave: number;
  preMaternityLeave: number;
};

interface EmployeeFormProps {
  /** When editing, pass in the existing values (partial is fine). */
  initialData?: Partial<EmployeeFormData>;
  /** Kept to avoid breaking callers; not used internally. */
  onSubmit?: (formData: EmployeeFormData) => Promise<void>;
  /** Controls button label text only (matches your original behavior). */
  isLoading: boolean;
}

/* ---------------- Component ---------------- */

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  initialData,
  onSubmit, // intentionally unused to preserve behavior
  isLoading,
}) => {
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: initialData?.name ?? "",
    designation: initialData?.designation ?? "",
    joinedDate: initialData?.joinedDate ?? "",
    address: initialData?.address ?? "",
    section: initialData?.section ?? "",
    recordCardNumber: initialData?.recordCardNumber ?? "",
    sickLeave: initialData?.sickLeave ?? 0,
    certificateSickLeave: initialData?.certificateSickLeave ?? 0,
    annualLeave: initialData?.annualLeave ?? 0,
    familyRelatedLeave: initialData?.familyRelatedLeave ?? 0,
    maternityLeave: initialData?.maternityLeave ?? 0,
    paternityLeave: initialData?.paternityLeave ?? 0,
    officialLeave: initialData?.officialLeave ?? 0,
    noPayLeave: initialData?.noPayLeave ?? 0,
    preMaternityLeave: initialData?.preMaternityLeave ?? 0,
  });

  // local submit-disabling state (kept from your original)
  const [loading, setLoading] = useState(false);

  const params = useParams();
  const employeeId = Array.isArray(params.id)
    ? params.id[0]
    : (params.id as string | undefined);
  const router = useRouter();

  const numericFields: (keyof EmployeeFormData)[] = [
    "sickLeave",
    "certificateSickLeave",
    "annualLeave",
    "familyRelatedLeave",
    "maternityLeave",
    "paternityLeave",
    "officialLeave",
    "noPayLeave",
    "preMaternityLeave",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const key = name as keyof EmployeeFormData;

    setFormData((prev) => ({
      ...prev,
      [key]: numericFields.includes(key) ? parseInt(value, 10) || 0 : value,
    }));
  };

  const resetForm = () =>
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
      preMaternityLeave: 0,
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (employeeId) {
        await updateEmployeeRecord(employeeId, formData);
        toast({
          title: "Success",
          description: `${formData.name} updated successfully`,
          variant: "default",
        });
      } else {
        await createEmployeeRecord(formData);
        toast({
          title: "Success",
          description: `${formData.name} added successfully`,
          variant: "default",
        });
      }

      router.push("/employees");
      resetForm();
    } catch {
      toast({
        title: "Error",
        description: `Failed to ${employeeId ? "update" : "add"} employee ${
          formData.name
        }`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-8">
      <h1 className="mt-10 mb-5 text-3xl font-bold">
        {employeeId ? "Edit Employee" : "Add Employee"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-10 grid grid-cols-1 gap-6">
        <div className="flex flex-wrap gap-4 lg:flex-row">
          {/* Name */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            />
          </div>

          {/* Address */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            />
          </div>

          {/* Designation */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="designation">
              Designation
            </label>
            <select
              id="designation"
              name="designation"
              value={formData.designation}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            >
              <option value="">Select Designation</option>
              <option value="Council President">Council President</option>
              <option value="Council Vice President">
                Council Vice President
              </option>
              <option value="Council Member">Council Member</option>
              <option value="Council Executive">Council Executive</option>
              <option value="Finance Officer">Finance Officer</option>
              <option value="Council Officer">Council Officer</option>
              <option value="A. Council Officer">A. Council Officer</option>
              <option value="Council Assistant">Council Assistant</option>
              <option value="Imam">Imam</option>
              <option value="Mosque Assistant">Mosque Assistant</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 lg:flex-row">
          {/* Section */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="section">
              Section
            </label>
            <select
              id="section"
              name="section"
              value={formData.section}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            >
              <option value="">Select Section</option>
              <option value="Councillor">Councillor</option>
              <option value="Admin">Admin</option>
              <option value="Imam">Imam</option>
              <option value="Mosque Assistant">Mosque Assistant</option>
            </select>
          </div>

          {/* Record Card Number */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="recordCardNumber">
              Record Card Number
            </label>
            <input
              id="recordCardNumber"
              name="recordCardNumber"
              type="text"
              value={formData.recordCardNumber}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            />
          </div>

          {/* Joined Date */}
          <div className="min-w-[250px] flex-1">
            <label className="mb-2 block font-bold" htmlFor="joinedDate">
              Joined Date
            </label>
            <input
              id="joinedDate"
              name="joinedDate"
              type="date"
              value={formData.joinedDate}
              onChange={handleInputChange}
              className="h-12 w-full rounded border p-2"
              required
            />
          </div>
        </div>

        {/* Leave buckets */}
        <div className="flex flex-wrap gap-4 lg:flex-row">
          <NumberField
            id="sickLeave"
            label="Sick Leave"
            value={formData.sickLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="certificateSickLeave"
            label="Certificate Sick Leave"
            value={formData.certificateSickLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="annualLeave"
            label="Annual Leave"
            value={formData.annualLeave}
            onChange={handleInputChange}
          />
        </div>

        <div className="flex flex-wrap gap-4 lg:flex-row">
          <NumberField
            id="familyRelatedLeave"
            label="Family Related Leave"
            value={formData.familyRelatedLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="preMaternityLeave"
            label="Pre-Maternity Leave"
            value={formData.preMaternityLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="maternityLeave"
            label="Maternity Leave"
            value={formData.maternityLeave}
            onChange={handleInputChange}
          />
        </div>

        <div className="flex flex-wrap gap-4 lg:flex-row">
          <NumberField
            id="paternityLeave"
            label="Paternity Leave"
            value={formData.paternityLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="officialLeave"
            label="Official Leave"
            value={formData.officialLeave}
            onChange={handleInputChange}
          />
          <NumberField
            id="noPayLeave"
            label="No Pay Leave"
            value={formData.noPayLeave}
            onChange={handleInputChange}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="custom-button h-12 w-full px-8 md:w-auto"
            disabled={loading}
          >
            {isLoading
              ? employeeId
                ? "Updating Employee..."
                : "Adding Employee..."
              : employeeId
              ? "Update Employee"
              : "Add Employee"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;

/* ---------------- Small helper component ---------------- */

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: keyof EmployeeFormData;
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="min-w-[250px] flex-1">
      <label className="mb-2 block font-bold" htmlFor={id as string}>
        {label}
      </label>
      <input
        id={id as string}
        name={id as string}
        type="number"
        min={0}
        value={value}
        onChange={onChange}
        className="h-12 w-full rounded border p-2"
        required
      />
    </div>
  );
}
