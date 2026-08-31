import type { PrayerKey } from "@/types";

export const MALDIVES_TIMEZONE = "Asia/Maldives" as const;
export const ATTENDANCE_SYNC_VERSION = 1 as const;
export const MAX_PRAYER_DISTANCE_MINUTES = 90;
export const MAX_LATENESS_MINUTES = 64;
export const ETIME_MAX_DAYS = 62;

export type AttendancePunchSource = "zkteco" | "etime";

export type MosquePrayer = PrayerKey;

export type EmployeeAttendanceSyncConfig = {
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  zkteco?: {
    enabled: boolean;
    userId: string;
  };
  etime?: {
    enabled: boolean;
    employeeCode: string;
    departmentId: string;
  };
};

export type AttendancePunchDoc = {
  source: AttendancePunchSource;
  sourceRecordId: string;
  sourceDeviceId: string | null;
  sourceEmployeeId: string;
  employeeId: string | null;
  timestampUtc: string;
  localDate: string;
  localTime: string;
  timezone: typeof MALDIVES_TIMEZONE;
  eligible: boolean;
  ignoredReason: string | null;
  lastSeenAt: string;
  voidedAt: string | null;
  importedAt: string;
  dedupeKey: string;
  /** Legacy fields kept for council punch lookup */
  empId?: string;
  empName?: string | null;
  empNameNorm?: string | null;
  timestamp?: string;
  deviceSn?: string;
  deviceUserId?: string;
  state?: number;
  createdAt?: string;
};

export type MosqueAttendanceAutomation = {
  version: typeof ATTENDANCE_SYNC_VERSION;
  lastReconciledAt: string | null;
  manualOverridePrayers: MosquePrayer[];
  prayerPunchRefs: Partial<
    Record<
      MosquePrayer,
      {
        punchLogId: string;
        source: AttendancePunchSource;
        timestampUtc: string;
      }
    >
  >;
};

export type EnsureResult = {
  date: string;
  created: number;
  reused: number;
  skipped: number;
  conflicts: Array<{ employeeId: string; rowIds: string[] }>;
  preview: boolean;
};

export type ImportResult = {
  scanned: number;
  valid: number;
  written: number;
  skipped: number;
  unmatched: number;
  voided?: number;
  affectedDates: string[];
  from?: string;
  to?: string;
};

export type ReconcilePrayerPreview = {
  prayer: MosquePrayer;
  signInTime: string | null;
  minutesLate: number;
  punchLogId: string | null;
  source: AttendancePunchSource | null;
  skippedReason?: "manual_override" | "leave" | "no_punch" | "unchanged";
};

export type ReconcileEmployeeResult = {
  employeeId: string;
  employeeName: string;
  rowId: string | null;
  conflict?: boolean;
  prayers: ReconcilePrayerPreview[];
  updated: boolean;
};

export type ReconcileResult = {
  date: string;
  preview: boolean;
  employees: ReconcileEmployeeResult[];
  updatedCount: number;
  conflictCount: number;
};

export type AttendanceSyncRunMode = "preview" | "apply";

export type AttendanceSyncRunRequest = {
  from: string;
  to: string;
  sources: AttendancePunchSource[];
  mode: AttendanceSyncRunMode;
  reconcile?: boolean;
  ensureSheets?: boolean;
};

export const PRAYER_FIELD_MAP: Record<
  "fathis" | "mendhuru" | "asuru" | "maqrib" | "isha",
  { signIn: MosquePrayer; minutesLate: keyof import("@/lib/firebase/types").MosqueAttendanceDoc }
> = {
  fathis: { signIn: "fathisSignInTime", minutesLate: "fathisMinutesLate" },
  mendhuru: { signIn: "mendhuruSignInTime", minutesLate: "mendhuruMinutesLate" },
  asuru: { signIn: "asuruSignInTime", minutesLate: "asuruMinutesLate" },
  maqrib: { signIn: "maqribSignInTime", minutesLate: "maqribMinutesLate" },
  isha: { signIn: "ishaSignInTime", minutesLate: "ishaMinutesLate" },
};

export const MOSQUE_PRAYERS: MosquePrayer[] = [
  "fathisSignInTime",
  "mendhuruSignInTime",
  "asuruSignInTime",
  "maqribSignInTime",
  "ishaSignInTime",
];

export const PRAYER_TIME_KEYS = [
  "fathisTime",
  "mendhuruTime",
  "asuruTime",
  "maqribTime",
  "ishaTime",
] as const;

export type PrayerTimeKey = (typeof PRAYER_TIME_KEYS)[number];

export type PrayerTimesByKey = Record<PrayerTimeKey, string>;
