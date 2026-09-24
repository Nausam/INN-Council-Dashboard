export const SALAAM_FAMILY_LEAVE_TYPES = [
  { value: "salaam", labelDv: "ސަލާމް", labelEn: "Salaam" },
  { value: "family", labelDv: "އާއިލީ ޒިންމާ", labelEn: "Family Related Leave" },
] as const;

export type SalaamFamilyLeaveType =
  (typeof SALAAM_FAMILY_LEAVE_TYPES)[number]["value"];

export function isSalaamFamilyLeaveType(
  value: unknown,
): value is SalaamFamilyLeaveType {
  return typeof value === "string" && SALAAM_FAMILY_LEAVE_TYPES.some((type) => type.value === value);
}
