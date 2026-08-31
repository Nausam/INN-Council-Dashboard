import type { EmployeeDoc } from "@/lib/firebase/types";
import type { EmployeeAttendanceSyncConfig } from "@/lib/attendance-sync/types";
import { isIsoDate } from "@/lib/attendance-sync/time";

export type SyncEligibleEmployee = {
  employee: EmployeeDoc;
  config: EmployeeAttendanceSyncConfig;
};

/** Known bootstrap mappings from ATTENDANCE_SYNC_PLAN.md */
export const BOOTSTRAP_SYNC_BY_NAME: Record<
  string,
  Omit<EmployeeAttendanceSyncConfig, "enabled" | "effectiveFrom">
> = {
  "Mohamed Shahidh": {
    zkteco: { enabled: true, userId: "18" },
    etime: { enabled: true, employeeCode: "4", departmentId: "1" },
  },
  "Ahmed Zahidh": {
    zkteco: { enabled: true, userId: "30" },
    etime: { enabled: true, employeeCode: "3", departmentId: "1" },
  },
  "Mohamed Mahir": {
    zkteco: { enabled: true, userId: "10" },
    etime: { enabled: true, employeeCode: "7", departmentId: "2" },
  },
  "Ibrahim Hashim": {
    zkteco: { enabled: true, userId: "15" },
    etime: { enabled: true, employeeCode: "8", departmentId: "2" },
  },
  "Ibrahim Waseem": {
    zkteco: { enabled: true, userId: "13" },
    etime: { enabled: true, employeeCode: "5", departmentId: "2" },
  },
  "Hawwa Luiza": {
    zkteco: { enabled: true, userId: "35" },
  },
};

export function isMosqueSyncDesignation(designation?: string): boolean {
  return designation === "Imam" || designation === "Council Assistant";
}

export function resolveEmployeeSyncConfig(
  employee: EmployeeDoc,
): EmployeeAttendanceSyncConfig | null {
  const stored = employee.attendanceSync as EmployeeAttendanceSyncConfig | undefined;
  if (stored?.enabled) {
    return stored;
  }

  const bootstrap = BOOTSTRAP_SYNC_BY_NAME[employee.name?.trim() ?? ""];
  if (bootstrap) {
    return {
      enabled: true,
      effectiveFrom: "2020-01-01",
      ...bootstrap,
    };
  }

  if (
    employee.section === "Mosque" &&
    isMosqueSyncDesignation(employee.designation)
  ) {
    return {
      enabled: true,
      effectiveFrom: "2020-01-01",
    };
  }

  return null;
}

export function isEmployeeEligibleForDate(
  employee: EmployeeDoc,
  config: EmployeeAttendanceSyncConfig,
  date: string,
): boolean {
  if (!config.enabled) return false;
  if (employee.section !== "Mosque") return false;
  if (!isMosqueSyncDesignation(employee.designation)) return false;
  if (!isIsoDate(date)) return false;
  if (date < config.effectiveFrom) return false;
  if (config.effectiveTo && date > config.effectiveTo) return false;
  return true;
}

export function listSyncEligibleEmployees(
  employees: EmployeeDoc[],
  date: string,
): SyncEligibleEmployee[] {
  const results: SyncEligibleEmployee[] = [];

  for (const employee of employees) {
    const config = resolveEmployeeSyncConfig(employee);
    if (!config) continue;
    if (!isEmployeeEligibleForDate(employee, config, date)) continue;
    results.push({ employee, config });
  }

  return results.sort((a, b) => a.employee.name.localeCompare(b.employee.name));
}

export type SourceEmployeeMaps = {
  zkByUserId: Map<string, SyncEligibleEmployee>;
  etimeByCode: Map<string, SyncEligibleEmployee>;
  byEmployeeId: Map<string, SyncEligibleEmployee>;
  duplicateZkIds: string[];
  duplicateEtimeCodes: string[];
};

export function buildSourceEmployeeMaps(
  employees: EmployeeDoc[],
  date: string,
): SourceEmployeeMaps {
  const eligible = listSyncEligibleEmployees(employees, date);
  const zkByUserId = new Map<string, SyncEligibleEmployee>();
  const etimeByCode = new Map<string, SyncEligibleEmployee>();
  const byEmployeeId = new Map<string, SyncEligibleEmployee>();
  const duplicateZkIds: string[] = [];
  const duplicateEtimeCodes: string[] = [];

  for (const entry of eligible) {
    byEmployeeId.set(entry.employee.$id, entry);

    const zkId = entry.config.zkteco?.enabled
      ? entry.config.zkteco.userId.trim()
      : "";
    if (zkId) {
      if (zkByUserId.has(zkId)) duplicateZkIds.push(zkId);
      else zkByUserId.set(zkId, entry);
    }

    const etimeCode = entry.config.etime?.enabled
      ? entry.config.etime.employeeCode.trim()
      : "";
    if (etimeCode) {
      if (etimeByCode.has(etimeCode)) duplicateEtimeCodes.push(etimeCode);
      else etimeByCode.set(etimeCode, entry);
    }
  }

  return {
    zkByUserId,
    etimeByCode,
    byEmployeeId,
    duplicateZkIds,
    duplicateEtimeCodes,
  };
}

export function graceMinutesForDesignation(designation?: string): number {
  if (designation === "Imam") return 5;
  if (designation === "Council Assistant") return 15;
  return 0;
}
