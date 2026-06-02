import type { MosqueAttendanceRecord } from "@/types";

export type LegacyDocument = {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
};

export type LeaveRequest = LegacyDocument & {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  approvalStatus: string;
  createdAt?: string;
  actionBy?: string;
};

export type EmployeeDoc = LegacyDocument & {
  name: string;
  designation?: string;
  section?: string;
  deviceUserId?: string;
  recordCardNumber?: string;
  joinedDate?: string;
  address?: string;
  sickLeave?: number;
  certificateSickLeave?: number;
  annualLeave?: number;
  familyRelatedLeave?: number;
  maternityLeave?: number;
  preMaternityLeave?: number;
  paternityLeave?: number;
  noPayLeave?: number;
  officialLeave?: number;
  basicSalary?: number;
  /** @deprecated Use creditSchemes */
  creditScheme?: number;
  creditSchemes?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    startMonthAmount: number;
    endMonthAmount: number;
  }>;
  retirementPension?: number;
  jobAllowance?: number;
  /** MVR per working day */
  attendanceBenefit?: number;
  /** MVR per working day */
  temporaryZvAllowance?: number;
  ramazanAllowance?: number;
  livingAllowance?: number;
  phoneAllowance?: number;
  [key: string]: unknown;
};

export type AttendanceDoc = LegacyDocument & {
  employeeId: string;
  date: string;
  signInTime: string | null;
  leaveType: string | null;
  minutesLate: number;
  previousLeaveType?: string | null;
  leaveDeducted?: boolean;
};

export type MosqueAttendanceDoc = LegacyDocument & {
  employeeId: string;
  date: string;
  fathisSignInTime: string | null;
  mendhuruSignInTime: string | null;
  asuruSignInTime: string | null;
  maqribSignInTime: string | null;
  ishaSignInTime: string | null;
  fathisMinutesLate: number | null;
  mendhuruMinutesLate: number | null;
  asuruMinutesLate: number | null;
  maqribMinutesLate: number | null;
  ishaMinutesLate: number | null;
  previousLeaveType?: string | null;
  leaveDeducted?: boolean;
  leaveType: string | null;
  changed?: boolean;
  [key: string]: unknown;
};

export type PrayerTimesDoc = LegacyDocument & {
  date: string;
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

export type SalarySlipDoc = LegacyDocument & {
  recordCardNumber: string;
  employeeId?: string;
  periodLabel: string;
  objectKey: string;
  fileName?: string;
};

export type PunchLogRaw = LegacyDocument & {
  empId?: string;
  empName?: string;
  empNameNorm?: string;
  timestamp?: string | null;
  state?: number;
  deviceSn?: string;
  deviceUserId?: string;
  dedupeKey?: string;
};

export type {
  CorrespondenceDoc,
  CorrespondenceChannel,
  CorrespondenceStatus,
} from "@/types/correspondence";

export type LandParcelDoc = LegacyDocument & {
  name: string;
  sizeSqft: number;
};

export type LandTenantDoc = LegacyDocument & {
  fullName: string;
};

export type LandLeaseDoc = LegacyDocument & {
  parcelId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  agreementNumber: string;
  releasedDate?: string | null;
  rateLariPerSqft: number;
  paymentDueDay?: number;
  fineLariPerDay?: number;
  agreementPdfFileId?: string | null;
  agreementPdfFilename?: string | null;
  status?: string | null;
};

export type LandStatementStatus = "OPEN" | "PAID";

export type LandStatementDoc = LegacyDocument & {
  leaseId: string;
  monthKey: string;
  status: LandStatementStatus;
  createdAt: string;
  createdBy?: string | null;
  landName?: string | null;
  tenantName?: string | null;
  agreementNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  releasedDate?: string | null;
  sizeSqft?: number | null;
  rateLariPerSqft?: number | null;
  paymentDueDay?: number | null;
  fineLariPerDay?: number | null;
  monthlyRent?: number | null;
  snapshot_totalRentPaymentMonthly?: number | null;
  snapshot_monthlyRentPaymentAmount?: number | null;
  snapshot_unpaidMonths?: number | null;
  snapshot_outstandingFees?: number | null;
  snapshot_numberOfFineDays?: number | null;
  snapshot_fineAmount?: number | null;
  snapshot_latestPaymentDate?: string | null;
  snapshot_fineBreakdownJson?: string | null;
  snapshot_capToEndDate?: boolean | null;
};

export type LandPaymentDoc = LegacyDocument & {
  leaseId: string;
  statementId: string;
  paidAt: string;
  amount: number;
  method?: string;
  note?: string;
  receivedBy?: string;
  slipFileId: string;
  slipFileName: string;
  slipMime?: string | null;
};
