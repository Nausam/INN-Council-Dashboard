"use client";

import {
  CouncilCard,
  CouncilDatePicker,
  CouncilSelect,
  type CouncilSelectOption,
  PageHeader,
  PageShell,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useQueryInvalidation } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { typography } from "@/lib/design-tokens";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
} from "@/lib/firebase/hr";
import { CreditSchemesFormSection } from "@/components/employees/CreditSchemesFormSection";
import {
  creditSchemesForFirestore,
  type CreditSchemeEntry,
} from "@/lib/employees/credit-schemes";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  Award,
  Baby,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Heart,
  Clock,
  Home,
  Landmark,
  MapPin,
  Phone,
  User,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/* ---------------- Types ---------------- */

export type { CreditSchemeEntry };

export type EmployeeFormData = {
  name: string;
  designation: string;
  joinedDate: string;
  address: string;
  section: string;
  recordCardNumber: string;
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  officialLeave: number;
  noPayLeave: number;
  preMaternityLeave: number;
  basicSalary: number;
  creditSchemes: CreditSchemeEntry[];
  retirementPension: number;
  jobAllowance: number;
  attendanceBenefit: number;
  temporaryZvAllowance: number;
  ramazanAllowance: number;
  livingAllowance: number;
  phoneAllowance: number;
};

const LEAVE_NUMERIC_FIELDS: (keyof EmployeeFormData)[] = [
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

type SalaryFieldKey =
  | "basicSalary"
  | "retirementPension"
  | "jobAllowance"
  | "attendanceBenefit"
  | "temporaryZvAllowance"
  | "ramazanAllowance"
  | "livingAllowance"
  | "phoneAllowance";

const SALARY_NUMERIC_FIELDS: SalaryFieldKey[] = [
  "basicSalary",
  "retirementPension",
  "jobAllowance",
  "attendanceBenefit",
  "temporaryZvAllowance",
  "ramazanAllowance",
  "livingAllowance",
  "phoneAllowance",
];

const defaultSalaryFields: Record<SalaryFieldKey, number> = {
  basicSalary: 0,
  retirementPension: 0,
  jobAllowance: 0,
  attendanceBenefit: 0,
  temporaryZvAllowance: 0,
  ramazanAllowance: 0,
  livingAllowance: 0,
  phoneAllowance: 0,
};

function buildInitialFormData(
  initialData?: Partial<EmployeeFormData>,
): EmployeeFormData {
  return {
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
    basicSalary: initialData?.basicSalary ?? 0,
    creditSchemes: initialData?.creditSchemes ?? [],
    retirementPension: initialData?.retirementPension ?? 0,
    jobAllowance: initialData?.jobAllowance ?? 0,
    attendanceBenefit: initialData?.attendanceBenefit ?? 0,
    temporaryZvAllowance: initialData?.temporaryZvAllowance ?? 0,
    ramazanAllowance: initialData?.ramazanAllowance ?? 0,
    livingAllowance: initialData?.livingAllowance ?? 0,
    phoneAllowance: initialData?.phoneAllowance ?? 0,
  };
}

const SALARY_FIELD_CONFIG: {
  id: SalaryFieldKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "basicSalary", label: "Basic Salary", icon: DollarSign },
  { id: "retirementPension", label: "Retirement Pension", icon: Landmark },
  { id: "jobAllowance", label: "Job Allowance", icon: Briefcase },
  { id: "attendanceBenefit", label: "Attendance Benefit (per day)", icon: Clock },
  {
    id: "temporaryZvAllowance",
    label: "Temporary ZV Allowance (per day)",
    icon: Calendar,
  },
  { id: "ramazanAllowance", label: "Ramazan Allowance", icon: Award },
  { id: "livingAllowance", label: "Living Allowance", icon: Home },
  { id: "phoneAllowance", label: "Phone Allowance", icon: Phone },
];

interface EmployeeFormProps {
  initialData?: Partial<EmployeeFormData>;
  onSubmit?: (formData: EmployeeFormData) => Promise<void>;
  isLoading?: boolean;
  variant?: "page" | "modal";
  employeeId?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

const fieldClass =
  "council-input h-11 pl-10 pr-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

const DESIGNATION_OPTIONS: CouncilSelectOption[] = [
  { value: "Council President", label: "Council President" },
  { value: "Council Vice President", label: "Council Vice President" },
  { value: "Council Member", label: "Council Member" },
  { value: "Council Executive", label: "Council Executive" },
  { value: "A. Council Executive", label: "A. Council Executive" },
  { value: "Finance Officer", label: "Finance Officer" },
  { value: "Council Officer", label: "Council Officer" },
  { value: "A. Council Officer", label: "A. Council Officer" },
  { value: "Council Assistant", label: "Council Assistant" },
  { value: "Imam", label: "Imam" },
];

const SECTION_OPTIONS: CouncilSelectOption[] = [
  { value: "Councillor", label: "Councillor" },
  { value: "Admin", label: "Admin" },
  { value: "Mosque", label: "Mosque" },
  { value: "Waste Management", label: "Waste Management" },
];

/* ---------------- Component ---------------- */

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  initialData,
  onSubmit,
  isLoading: isLoadingProp,
  variant = "page",
  employeeId: employeeIdProp,
  onCancel,
  onSuccess,
}) => {
  const isModal = variant === "modal";
  const [formData, setFormData] = useState<EmployeeFormData>(() =>
    buildInitialFormData(initialData),
  );

  const [loading, setLoading] = useState(false);

  const params = useParams();
  const routeEmployeeId = Array.isArray(params.id)
    ? params.id[0]
    : (params.id as string | undefined);
  const employeeId = employeeIdProp ?? routeEmployeeId;
  const router = useRouter();
  const isEdit = Boolean(employeeId);
  const isSubmitting = isLoadingProp ?? loading;
  const { invalidateEmployees } = useQueryInvalidation();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const key = name as keyof EmployeeFormData;

    setFormData((prev) => ({
      ...prev,
      [key]: LEAVE_NUMERIC_FIELDS.includes(key)
        ? parseInt(value, 10) || 0
        : SALARY_NUMERIC_FIELDS.includes(key as SalaryFieldKey)
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleSelectChange = (
    name: keyof EmployeeFormData,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: keyof EmployeeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => setFormData(buildInitialFormData());

  const toFirestorePayload = (data: EmployeeFormData) => {
    const { creditSchemes, ...rest } = data;
    return {
      ...rest,
      creditSchemes: creditSchemesForFirestore(creditSchemes),
    };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const payload = toFirestorePayload(formData);

    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else if (employeeId) {
        await updateEmployeeRecord(employeeId, payload);
        await invalidateEmployees(employeeId);
        toast({
          title: "Success",
          description: `${formData.name} updated successfully`,
        });
      } else {
        const created = await createEmployeeRecord(payload);
        await invalidateEmployees(created.$id);
        toast({
          title: "Success",
          description: `${formData.name} added successfully`,
        });
      }

      if (onSuccess) {
        onSuccess();
      } else if (!isModal) {
        router.push("/employees");
      }
      if (!isEdit) resetForm();
    } catch {
      toast({
        title: "Error",
        description: `Failed to ${employeeId ? "update" : "add"} employee ${formData.name}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={User} title="Personal Information">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
          </FormSection>

          <FormSection icon={Briefcase} title="Employment Details">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SelectField
                id="designation"
                label="Designation"
                value={formData.designation}
                onValueChange={(value) =>
                  handleSelectChange("designation", value)
                }
                options={DESIGNATION_OPTIONS}
                icon={Briefcase}
                placeholder="Select designation"
                required
              />

              <SelectField
                id="section"
                label="Section"
                value={formData.section}
                onValueChange={(value) => handleSelectChange("section", value)}
                options={SECTION_OPTIONS}
                icon={Building2}
                placeholder="Select section"
                required
              />

              <InputField
                id="recordCardNumber"
                label="Record Card Number"
                value={formData.recordCardNumber}
                onChange={handleInputChange}
                icon={<CreditCard className="h-4 w-4" />}
                required
              />

              <DateField
                id="joinedDate"
                label="Joined Date"
                value={formData.joinedDate}
                onChange={(value) => handleDateChange("joinedDate", value)}
                icon={Calendar}
                placeholder="Select joined date"
                required
              />
            </div>
          </FormSection>

          <FormSection
            icon={CreditCard}
            title="Credit Scheme"
            description="Add schemes with a date range and start/end monthly amounts (MVR)"
          >
            <CreditSchemesFormSection
              schemes={formData.creditSchemes}
              onChange={(creditSchemes) =>
                setFormData((prev) => ({ ...prev, creditSchemes }))
              }
            />
          </FormSection>

          <FormSection
            icon={Wallet}
            title="Salary & Allowances"
            description="Salary components in MVR; attendance and ZV allowances are per day"
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SALARY_FIELD_CONFIG.map(({ id, label, icon: Icon }) => (
                <NumberField
                  key={id}
                  id={id}
                  label={label}
                  value={formData[id]}
                  onChange={handleInputChange}
                  icon={<Icon className="h-4 w-4" />}
                  required={false}
                  step="0.01"
                />
              ))}
            </div>
          </FormSection>

          <FormSection
            icon={Calendar}
            title="Leave Balances"
            description="Configure available leave days for this employee"
          >
            <div className="space-y-6">
              <div>
                <h3 className={cn(typography.caption, "mb-4 text-slate-700")}>
                  Standard Leave Types
                </h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

              <div>
                <h3 className={cn(typography.caption, "mb-4 text-slate-700")}>
                  Special Leave Types
                </h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          </FormSection>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="council-outline"
              className="h-11 rounded-xl px-6"
              onClick={() => {
                if (onCancel) onCancel();
                else router.push("/employees");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="council"
              className="h-11 rounded-xl px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isEdit ? "Updating..." : "Adding..."}
                </>
              ) : isEdit ? (
                "Update Employee"
              ) : (
                "Add Employee"
              )}
            </Button>
          </div>
        </form>
  );

  if (isModal) {
    return formBody;
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          icon={isEdit ? User : UserPlus}
          title={isEdit ? "Edit Employee" : "Add New Employee"}
          subtitle={
            isEdit
              ? "Update employee information and leave balances"
              : "Enter employee details to create a new record"
          }
        />
        {formBody}
      </div>
    </PageShell>
  );
};

export default EmployeeForm;

/* ---------------- Helper Components ---------------- */

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <CouncilCard interactive="none" className="p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">
            {title}
          </h2>
          {description && (
            <p className={cn(typography.body, "mt-1 text-sm font-medium")}>
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </CouncilCard>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label
      className="mb-2 block text-sm font-semibold text-slate-700"
      htmlFor={htmlFor}
    >
      {label}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  );
}

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
  const fieldId = id as string;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          id={fieldId}
          name={fieldId}
          type={type}
          value={value}
          onChange={onChange}
          className={fieldClass}
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
  onValueChange,
  options,
  icon,
  placeholder,
  required = false,
}: {
  id: keyof EmployeeFormData;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: CouncilSelectOption[];
  icon: LucideIcon;
  placeholder?: string;
  required?: boolean;
}) {
  const fieldId = id as string;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <CouncilSelect
        id={fieldId}
        name={fieldId}
        value={value}
        onValueChange={onValueChange}
        options={options}
        icon={icon}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  icon,
  placeholder,
  required = false,
}: {
  id: keyof EmployeeFormData;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: LucideIcon;
  placeholder?: string;
  required?: boolean;
}) {
  const fieldId = id as string;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <CouncilDatePicker
        id={fieldId}
        name={fieldId}
        value={value}
        onChange={onChange}
        icon={icon}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

type NumberFormFieldKey =
  | SalaryFieldKey
  | (typeof LEAVE_NUMERIC_FIELDS)[number];

function NumberField({
  id,
  label,
  value,
  onChange,
  icon,
  required = true,
  step = "1",
}: {
  id: NumberFormFieldKey;
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  required?: boolean;
  step?: string;
}) {
  const fieldId = id as string;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          id={fieldId}
          name={fieldId}
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={onChange}
          className={fieldClass}
          required={required}
        />
      </div>
    </div>
  );
}
