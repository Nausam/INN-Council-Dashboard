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
  | {
      status: "ok";
      employee: SlipMatchEmployee;
      method: "exact" | "recordCard" | "tokens" | "substring";
    }
  | { status: "none"; suggestions: string[] }
  | { status: "ambiguous"; names: string[]; reason: string };

const MIN_SUBSTRING_LEN = 5;

const NOISE_WORDS =
  /\b(salary|slip|slips|payslip|payroll|pdf|copy|final|draft|scan|scanned)\b/gi;
const MONTH_WORDS =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi;

/** Use only the PDF basename (handles folder picks and Windows paths). */
export function getSlipFileBaseName(fileName: string): string {
  const trimmed = fileName.trim();
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  return base.replace(/\.pdf$/i, "").trim();
}

function cleanStemForMatching(stem: string): string {
  return stem
    .replace(/\b([A-Z]?\d{5,})\b/gi, " ")
    .replace(NOISE_WORDS, " ")
    .replace(MONTH_WORDS, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s,._-]+/)
    .map((part) => normalizeNameForSlipMatch(part))
    .filter((part) => part.length >= 2);
}

function extractRecordCardCandidates(stem: string): string[] {
  const found = new Set<string>();
  const pattern = /\b([A-Z]?\d{5,})\b/gi;
  let match = pattern.exec(stem);
  while (match) {
    const value = match[1]?.trim();
    if (value) found.add(value.toUpperCase());
    match = pattern.exec(stem);
  }
  return Array.from(found);
}

function tokenMatchScore(stem: string, employeeName: string): number {
  const tokens = nameTokens(employeeName);
  if (tokens.length === 0) return 0;
  const normStem = normalizeNameForSlipMatch(stem);
  if (!normStem) return 0;

  let matched = 0;
  for (const token of tokens) {
    if (normStem.includes(token)) matched += 1;
  }
  return matched / tokens.length;
}

function findClosestEmployees(
  stem: string,
  employees: SlipMatchEmployee[],
  limit = 3,
): string[] {
  const scored = employees
    .map((employee) => ({
      label: `${employee.name} (${employee.recordCardNumber})`,
      score: tokenMatchScore(stem, employee.name),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((row) => row.label);
}

/**
 * Strip extension and match PDF basename to exactly one employee (normalized),
 * with record-card, token, and guarded substring fallbacks.
 */
export function matchEmployeeBySlipFileName(
  fileName: string,
  employees: SlipMatchEmployee[],
): SlipNameMatchResult {
  const base = getSlipFileBaseName(fileName);
  if (!base) {
    return { status: "none", suggestions: [] };
  }

  const cleanedStem = cleanStemForMatching(base);
  const normStem = normalizeNameForSlipMatch(cleanedStem || base);
  if (!normStem) {
    return { status: "none", suggestions: findClosestEmployees(base, employees) };
  }

  const exact = employees.filter(
    (employee) => normalizeNameForSlipMatch(employee.name) === normStem,
  );
  if (exact.length === 1) {
    return { status: "ok", employee: exact[0], method: "exact" };
  }
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      reason: "More than one employee has this exact name",
      names: exact.map((employee) => `${employee.name} (${employee.recordCardNumber})`),
    };
  }

  const recordCards = extractRecordCardCandidates(base);
  if (recordCards.length > 0) {
    const byRecordCard = employees.filter((employee) =>
      recordCards.includes(employee.recordCardNumber.trim().toUpperCase()),
    );
    if (byRecordCard.length === 1) {
      return { status: "ok", employee: byRecordCard[0], method: "recordCard" };
    }
    if (byRecordCard.length > 1) {
      return {
        status: "ambiguous",
        reason: "Record card in filename matches multiple employees",
        names: byRecordCard.map(
          (employee) => `${employee.name} (${employee.recordCardNumber})`,
        ),
      };
    }
  }

  const tokenMatches = employees
    .map((employee) => ({
      employee,
      score: tokenMatchScore(cleanedStem || base, employee.name),
    }))
    .filter((row) => row.score === 1);

  if (tokenMatches.length === 1) {
    return {
      status: "ok",
      employee: tokenMatches[0].employee,
      method: "tokens",
    };
  }
  if (tokenMatches.length > 1) {
    return {
      status: "ambiguous",
      reason: "Filename matches multiple employees equally well",
      names: tokenMatches.map(
        (row) => `${row.employee.name} (${row.employee.recordCardNumber})`,
      ),
    };
  }

  const longerStem = normStem.length >= MIN_SUBSTRING_LEN;
  const byContains = employees.filter((employee) => {
    const normalizedName = normalizeNameForSlipMatch(employee.name);
    if (!normalizedName) return false;
    if (longerStem && normalizedName.includes(normStem)) return true;
    if (
      normalizedName.length >= MIN_SUBSTRING_LEN &&
      normStem.includes(normalizedName)
    ) {
      return true;
    }
    return false;
  });
  if (byContains.length === 1) {
    return { status: "ok", employee: byContains[0], method: "substring" };
  }
  if (byContains.length > 1) {
    return {
      status: "ambiguous",
      reason: "Filename partially matches multiple employees",
      names: byContains.map(
        (employee) => `${employee.name} (${employee.recordCardNumber})`,
      ),
    };
  }

  return {
    status: "none",
    suggestions: findClosestEmployees(cleanedStem || base, employees),
  };
}

export function describeSlipMatchFailure(
  fileName: string,
  match: Extract<SlipNameMatchResult, { status: "none" | "ambiguous" }>,
): { error: string; detail?: string } {
  const base = getSlipFileBaseName(fileName) || fileName;

  if (match.status === "ambiguous") {
    return {
      error: match.reason,
      detail: `Possible matches: ${match.names.join("; ")}. Rename the file to the exact employee name or record card (e.g. ${match.names[0]?.match(/\(([^)]+)\)/)?.[1] ?? "A123456"}.pdf).`,
    };
  }

  if (match.suggestions.length > 0) {
    return {
      error: `No employee matched "${base}"`,
      detail: `Closest names in the system: ${match.suggestions.join("; ")}. Rename the file to an exact employee name (e.g. ${match.suggestions[0]?.split(" (")[0] ?? "Employee Name"}.pdf) or use the record card (e.g. A123456.pdf).`,
    };
  }

  return {
    error: `No employee matched "${base}"`,
    detail:
      "Rename the PDF to the employee's full name or record card number, for example Ahmed Azmeen.pdf or A068218.pdf.",
  };
}
