"use client";

import { toast } from "@/hooks/use-toast";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
} from "@/lib/appwrite/appwrite";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Heart,
  Baby,
  Users,
  DollarSign,
  Award,
  FileText,
} from "lucide-react";

/* ---------------- Types ---------------- */

export type EmployeeFormData = {
  name: string;
  designation: string;
  joinedDate: string;
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
  initialData?: Partial<EmployeeFormData>;
  onSubmit?: (formData: EmployeeFormData) => Promise<void>;
  isLoading: boolean;
}

/* ---------------- Component ---------------- */

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  initialData,
  onSubmit,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
              <User className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                {employeeId ? "Edit Employee" : "Add New Employee"}
              </h1>
              <p className="mt-1 text-slate-600">
                {employeeId
                  ? "Update employee information and leave balances"
                  : "Enter employee details to create a new record"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Personal Information
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <InputField
                id="name"
                label="Full Name"
                value={formData.name}
                onChange={handleInputChange}
                icon={<User className="h-4 w-4" />}
                required
              />
              <InputField
                id="address"
                label="Address"
                value={formData.address}
                onChange={handleInputChange}
                icon={<MapPin className="h-4 w-4" />}
                required
              />
            </div>
          </div>

          {/* Employment Details Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <Briefcase className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Employment Details
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SelectField
                id="designation"
                label="Designation"
                value={formData.designation}
                onChange={handleInputChange}
                icon={<Briefcase className="h-4 w-4" />}
                required
              >
                <option value="">Select Designation</option>
                <option value="Council President">Council President</option>
                <option value="Council Vice President">
                  Council Vice President
                </option>
                <option value="Council Member">Council Member</option>
                <option value="Council Executive">Council Executive</option>
                <option value="A. Council Executive">
                  A. Council Executive
                </option>
                <option value="Finance Officer">Finance Officer</option>
                <option value="Council Officer">Council Officer</option>
                <option value="A. Council Officer">A. Council Officer</option>
                <option value="Council Assistant">Council Assistant</option>
                <option value="Imam">Imam</option>
              </SelectField>

              <SelectField
                id="section"
                label="Section"
                value={formData.section}
                onChange={handleInputChange}
                icon={<Building2 className="h-4 w-4" />}
                required
              >
                <option value="">Select Section</option>
                <option value="Councillor">Councillor</option>
                <option value="Admin">Admin</option>
                <option value="Mosque">Mosque</option>
                <option value="Waste Management">Waste Management</option>
              </SelectField>

              <InputField
                id="recordCardNumber"
                label="Record Card Number"
                value={formData.recordCardNumber}
                onChange={handleInputChange}
                icon={<CreditCard className="h-4 w-4" />}
                required
              />

              <InputField
                id="joinedDate"
                label="Joined Date"
                type="date"
                value={formData.joinedDate}
                onChange={handleInputChange}
                icon={<Calendar className="h-4 w-4" />}
                required
              />
            </div>
          </div>

          {/* Leave Balances Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Calendar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Leave Balances
                </h2>
                <p className="text-sm text-slate-600">
                  Configure available leave days for this employee
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Standard Leave Types */}
              <div>
                <h3 className="mb-4 text-sm font-semibold text-slate-700">
                  Standard Leave Types
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    id="sickLeave"
                    label="Sick Leave"
                    value={formData.sickLeave}
                    onChange={handleInputChange}
                    icon={<Heart className="h-4 w-4" />}
                  />
                  <NumberField
                    id="certificateSickLeave"
                    label="Certificate Sick Leave"
                    value={formData.certificateSickLeave}
                    onChange={handleInputChange}
                    icon={<FileText className="h-4 w-4" />}
                  />
                  <NumberField
                    id="annualLeave"
                    label="Annual Leave"
                    value={formData.annualLeave}
                    onChange={handleInputChange}
                    icon={<Calendar className="h-4 w-4" />}
                  />
                </div>
              </div>

              {/* Special Leave Types */}
              <div>
                <h3 className="mb-4 text-sm font-semibold text-slate-700">
                  Special Leave Types
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    id="familyRelatedLeave"
                    label="Family Related Leave"
                    value={formData.familyRelatedLeave}
                    onChange={handleInputChange}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <NumberField
                    id="preMaternityLeave"
                    label="Pre-Maternity Leave"
                    value={formData.preMaternityLeave}
                    onChange={handleInputChange}
                    icon={<Heart className="h-4 w-4" />}
                  />
                  <NumberField
                    id="maternityLeave"
                    label="Maternity Leave"
                    value={formData.maternityLeave}
                    onChange={handleInputChange}
                    icon={<Baby className="h-4 w-4" />}
                  />
                  <NumberField
                    id="paternityLeave"
                    label="Paternity Leave"
                    value={formData.paternityLeave}
                    onChange={handleInputChange}
                    icon={<Baby className="h-4 w-4" />}
                  />
                  <NumberField
                    id="officialLeave"
                    label="Official Leave"
                    value={formData.officialLeave}
                    onChange={handleInputChange}
                    icon={<Award className="h-4 w-4" />}
                  />
                  <NumberField
                    id="noPayLeave"
                    label="No Pay Leave"
                    value={formData.noPayLeave}
                    onChange={handleInputChange}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push("/employees")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {employeeId ? "Updating..." : "Adding..."}
                </>
              ) : (
                <>{employeeId ? "Update Employee" : "Add Employee"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;

/* ---------------- Helper Components ---------------- */

function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  icon,
  required = false,
}: {
  id: keyof EmployeeFormData;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-slate-700"
        htmlFor={id as string}
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          id={id as string}
          name={id as string}
          type={type}
          value={value}
          onChange={onChange}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-slate-900 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          required={required}
        />
      </div>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  icon,
  required = false,
  children,
}: {
  id: keyof EmployeeFormData;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-slate-700"
        htmlFor={id as string}
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <select
          id={id as string}
          name={id as string}
          value={value}
          onChange={onChange}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-slate-900 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          required={required}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  icon,
}: {
  id: keyof EmployeeFormData;
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-slate-700"
        htmlFor={id as string}
      >
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          id={id as string}
          name={id as string}
          type="number"
          min={0}
          value={value}
          onChange={onChange}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-slate-900 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          required
        />
      </div>
    </div>
  );
}
