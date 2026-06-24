import type { EmployeeFormData } from "@/components/EmployeeForm";
import { parseCreditSchemesFromDoc } from "@/lib/employees/credit-schemes";
import {
  computeRetirementPension,
  retirementPensionAppliesFromDoc,
} from "@/lib/employees/retirement-pension";

export type EmployeeForDetails = {
  name: string;
  designation: string;
  section: string;
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  preMaternityLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  noPayLeave: number;
  officialLeave: number;
  joinedDate: string;
};

type EmployeeDoc = {
  name?: string;
  designation?: string;
  section?: string;
  joinedDate?: string | null;
  address?: string;
  recordCardNumber?: string;
  deviceUserId?: string;
  sickLeave?: number;
  certificateSickLeave?: number;
  annualLeave?: number;
  familyRelatedLeave?: number;
  maternityLeave?: number;
  paternityLeave?: number;
  officialLeave?: number;
  noPayLeave?: number;
  preMaternityLeave?: number;
  basicSalary?: number;
  creditScheme?: number;
  creditSchemes?: unknown;
  retirementPension?: number;
  retirementPensionApplies?: boolean;
  jobAllowance?: number;
  attendanceBenefit?: number;
  temporaryZvAllowance?: number;
  ramazanAllowance?: number;
  livingAllowance?: number;
  foodAllowance?: number;
  phoneAllowance?: number;
};

function salaryFieldsFromDoc(r: EmployeeDoc) {
  const basicSalary = num(r.basicSalary);
  const retirementPensionApplies = retirementPensionAppliesFromDoc(
    r.retirementPensionApplies,
  );
  return {
    basicSalary,
    retirementPensionApplies,
    retirementPension: computeRetirementPension(
      basicSalary,
      retirementPensionApplies,
    ),
    jobAllowance: num(r.jobAllowance),
    attendanceBenefit: num(r.attendanceBenefit),
    temporaryZvAllowance: num(r.temporaryZvAllowance),
    ramazanAllowance: num(r.ramazanAllowance),
    livingAllowance: num(r.livingAllowance),
    foodAllowance: num(r.foodAllowance),
    phoneAllowance: num(r.phoneAllowance),
  };
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function toEmployeeForDetails(raw: unknown): EmployeeForDetails {
  const r = (raw ?? {}) as EmployeeDoc;
  return {
    name: str(r.name),
    designation: str(r.designation),
    section: str(r.section),
    sickLeave: num(r.sickLeave),
    certificateSickLeave: num(r.certificateSickLeave),
    annualLeave: num(r.annualLeave),
    familyRelatedLeave: num(r.familyRelatedLeave),
    preMaternityLeave: num(r.preMaternityLeave),
    maternityLeave: num(r.maternityLeave),
    paternityLeave: num(r.paternityLeave),
    noPayLeave: num(r.noPayLeave),
    officialLeave: num(r.officialLeave),
    joinedDate: str(r.joinedDate),
  };
}

export function toEmployeeFormValues(raw: unknown): EmployeeFormData {
  const r = (raw ?? {}) as EmployeeDoc;
  return {
    name: str(r.name),
    designation: str(r.designation),
    joinedDate: r.joinedDate
      ? new Date(r.joinedDate).toISOString().split("T")[0]
      : "",
    address: str(r.address),
    section: str(r.section),
    recordCardNumber: str(r.recordCardNumber),
    deviceUserId: str(r.deviceUserId),
    sickLeave: num(r.sickLeave),
    certificateSickLeave: num(r.certificateSickLeave),
    annualLeave: num(r.annualLeave),
    familyRelatedLeave: num(r.familyRelatedLeave),
    maternityLeave: num(r.maternityLeave),
    paternityLeave: num(r.paternityLeave),
    officialLeave: num(r.officialLeave),
    noPayLeave: num(r.noPayLeave),
    preMaternityLeave: num(r.preMaternityLeave),
    ...salaryFieldsFromDoc(r),
    creditSchemes: parseCreditSchemesFromDoc(r.creditSchemes),
  };
}
