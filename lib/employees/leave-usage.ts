export const LEAVE_TOTAL_ALLOWANCE: Partial<Record<string, number>> = {
  sickLeave: 15,
  certificateSickLeave: 15,
  annualLeave: 30,
  familyRelatedLeave: 10,
};

export const ADDITIVE_LEAVE_KEYS = new Set([
  "maternityLeave",
  "preMaternityLeave",
  "paternityLeave",
  "noPayLeave",
  "officialLeave",
]);

export type LeaveUsageSummary = {
  used: number;
  remaining: number | null;
};

export function getLeaveUsageSummary(
  leaveType: string,
  balance: number,
): LeaveUsageSummary {
  const totalAllowance = LEAVE_TOTAL_ALLOWANCE[leaveType];

  if (totalAllowance !== undefined) {
    const remaining = balance;
    const used = Math.max(0, totalAllowance - remaining);
    return { used, remaining };
  }

  if (ADDITIVE_LEAVE_KEYS.has(leaveType)) {
    return { used: balance, remaining: null };
  }

  return { used: balance, remaining: null };
}
