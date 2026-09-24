export const LEAVE_SUPERVISORS = [
  { key: "imran", label: "Imran", employeeId: "68feffcb000186881058" },
  { key: "shazuly", label: "Shazuly", employeeId: "68ff0726000476cd4ba8" },
  { key: "haleem", label: "Haleem", employeeId: "6a1bf31e00078e19c13d" },
  { key: "areef", label: "Areef", employeeId: "6a1bf36c00017abeb98f" },
] as const;

export type LeaveSupervisorKey = (typeof LEAVE_SUPERVISORS)[number]["key"];

export function getLeaveSupervisor(key: string) {
  return LEAVE_SUPERVISORS.find((supervisor) => supervisor.key === key);
}
