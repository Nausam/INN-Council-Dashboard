export const SALAAM_FAMILY_LEAVE_TYPES = [
  { value: "salaam", labelDv: "ސަލާމް", labelEn: "Salaam" },
  { value: "certificateSalaam", labelDv: "ސެޓިފިކެޓް ސަލާމް", labelEn: "Certificate Salaam" },
  { value: "family", labelDv: "އާއިލީ ޒިންމާ", labelEn: "Family Related Leave" },
] as const;

export type SalaamFamilyLeaveType =
  (typeof SALAAM_FAMILY_LEAVE_TYPES)[number]["value"];

/**
 * Employee balance each form type comes out of. Salaam is the no-certificate
 * sick notice; Certificate Salaam comes with a medical certificate attached.
 */
export const ATTENDANCE_LEAVE_TYPE: Record<SalaamFamilyLeaveType, string> = {
  salaam: "sickLeave",
  certificateSalaam: "certificateSickLeave",
  family: "familyRelatedLeave",
};

/** Both kinds of sick leave form, which share the Salaam request screen. */
export function isSalaamKind(value: unknown): value is "salaam" | "certificateSalaam" {
  return value === "salaam" || value === "certificateSalaam";
}

/** The medical certificate attached to a Certificate Salaam form, stored in R2. */
export type LeaveCertificate = {
  key: string;
  contentType: string;
  fileName: string;
  size: number;
};

export const LEAVE_CERTIFICATE_PREFIX = "leave-certificates/";
export const LEAVE_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

/** The employee a certificate belongs to, from its key (leave-certificates/<employeeId>/...). */
export function employeeIdFromCertificateKey(key: string): string | null {
  if (!key.startsWith(LEAVE_CERTIFICATE_PREFIX)) return null;
  const employeeId = key.slice(LEAVE_CERTIFICATE_PREFIX.length).split("/")[0];
  return /^[\w-]{1,128}$/.test(employeeId) ? employeeId : null;
}

export type LeaveDayDetails = { date: string; time: string; reason: string };

export function isSalaamFamilyLeaveType(
  value: unknown,
): value is SalaamFamilyLeaveType {
  return typeof value === "string" && SALAAM_FAMILY_LEAVE_TYPES.some((type) => type.value === value);
}
