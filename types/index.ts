export interface MosqueAttendanceRecord {
  $id: string;
  employeeId: { name: string; $id: string; section: string };
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
  previousLeaveType: string | null;
  leaveDeducted: boolean;
  leaveType: string | null;
  changed: boolean;
}

export interface MosqueAttendanceTableProps {
  date: string;
  data: MosqueAttendanceRecord[];
}

export const prayers = [
  "fathisSignInTime",
  "mendhuruSignInTime",
  "asuruSignInTime",
  "maqribSignInTime",
  "ishaSignInTime",
];

export const leaveTypes = [
  "Sick Leave",
  "Certificate Leave",
  "Annual Leave",
  "Family Related Leave",
  "Maternity Leave",
  "Paternity Leave",
  "No Pay Leave",
  "Official Leave",
];

export const leaveTypeMapping = {
  "Sick Leave": "sickLeave",
  "Certificate Leave": "certificateSickLeave",
  "Annual Leave": "annualLeave",
  "Family Related Leave": "familyRelatedLeave",
  "Maternity Leave": "maternityLeave",
  "Paternity Leave": "paternityLeave",
  "No Pay Leave": "noPayLeave",
  "Official Leave": "officialLeave",
};

// Define valid prayer keys
export type PrayerKey =
  | "fathisSignInTime"
  | "mendhuruSignInTime"
  | "asuruSignInTime"
  | "maqribSignInTime"
  | "ishaSignInTime";

export type Registration = {
  fullName: string;
  address: string;
  contactNumber: number;
  idCard: string;
  isCitizen: boolean;
  isCompany: boolean;
  isRetailer: boolean;
};
