export const RETIREMENT_PENSION_RATE = 0.07;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Retirement pension is 7% of basic salary (MVR) when it applies. */
export function computeRetirementPension(
  basicSalary: number,
  applies = true,
): number {
  if (!applies) return 0;
  const basic = Number.isFinite(basicSalary) ? basicSalary : 0;
  return round2(basic * RETIREMENT_PENSION_RATE);
}

export function retirementPensionAppliesFromDoc(
  value: unknown,
  fallback = true,
): boolean {
  return typeof value === "boolean" ? value : fallback;
}
