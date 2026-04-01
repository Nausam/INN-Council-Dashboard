/** Same normalization as punch logs (`empNameNorm`): comparable across PDF filenames and employee names. */
export function normalizeNameForSlipMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type SlipMatchEmployee = {
  id: string;
  name: string;
  recordCardNumber: string;
};

export type SlipNameMatchResult =
  | { status: "ok"; employee: SlipMatchEmployee }
  | { status: "none" }
  | { status: "ambiguous"; names: string[] };

const MIN_SUBSTRING_LEN = 8;

/**
 * Strip extension and match PDF basename to exactly one employee (normalized),
 * with a guarded substring fallback when names differ in length.
 */
export function matchEmployeeBySlipFileName(
  fileName: string,
  employees: SlipMatchEmployee[],
): SlipNameMatchResult {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  if (!base) return { status: "none" };

  const normStem = normalizeNameForSlipMatch(base);
  if (!normStem) return { status: "none" };

  const exact = employees.filter(
    (e) => normalizeNameForSlipMatch(e.name) === normStem,
  );
  if (exact.length === 1) return { status: "ok", employee: exact[0] };
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      names: exact.map((e) => `${e.name} (${e.recordCardNumber})`),
    };
  }

  const longerStem = normStem.length >= MIN_SUBSTRING_LEN;
  const byContains = employees.filter((e) => {
    const n = normalizeNameForSlipMatch(e.name);
    if (!n) return false;
    if (longerStem && n.includes(normStem)) return true;
    if (n.length >= MIN_SUBSTRING_LEN && normStem.includes(n)) return true;
    return false;
  });
  if (byContains.length === 1) return { status: "ok", employee: byContains[0] };
  if (byContains.length > 1) {
    return {
      status: "ambiguous",
      names: byContains.map((e) => `${e.name} (${e.recordCardNumber})`),
    };
  }

  return { status: "none" };
}
