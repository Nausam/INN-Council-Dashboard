export type CreditSchemeEntry = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  startMonthAmount: number;
  endMonthAmount: number;
};

export type EmployeeCreditSchemeRecord = {
  name: string;
  startDate: string;
  endDate: string;
  startMonthAmount: number;
  endMonthAmount: number;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function toDateInputValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    try {
      return new Date(trimmed).toISOString().split("T")[0] ?? "";
    } catch {
      return "";
    }
  }
  if (v instanceof Date) {
    return v.toISOString().split("T")[0] ?? "";
  }
  if (typeof v === "object" && v !== null && "toDate" in v) {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d.toISOString().split("T")[0] ?? "";
    } catch {
      return "";
    }
  }
  return "";
}

function newSchemeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCreditScheme(name: string): CreditSchemeEntry {
  return {
    id: newSchemeId(),
    name: name.trim(),
    startDate: "",
    endDate: "",
    startMonthAmount: 0,
    endMonthAmount: 0,
  };
}

function normalizeEntry(raw: unknown, index: number): CreditSchemeEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const startDate = toDateInputValue(r.startDate);
  const endDate = toDateInputValue(r.endDate);
  const name = str(r.name);
  const startMonthAmount = num(r.startMonthAmount);
  const endMonthAmount = num(r.endMonthAmount);

  if (
    !name &&
    !startDate &&
    !endDate &&
    startMonthAmount === 0 &&
    endMonthAmount === 0
  ) {
    return null;
  }

  return {
    id:
      typeof r.id === "string" && r.id.trim()
        ? r.id
        : `scheme-${index}-${startDate || endDate || index}`,
    name,
    startDate,
    endDate,
    startMonthAmount,
    endMonthAmount,
  };
}

export function parseCreditSchemesFromDoc(raw: unknown): CreditSchemeEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeEntry(item, index))
    .filter((entry): entry is CreditSchemeEntry => entry !== null);
}

export function creditSchemesForFirestore(
  entries: CreditSchemeEntry[],
): EmployeeCreditSchemeRecord[] {
  return entries
    .filter((e) => e.name.trim() !== "")
    .map(({ name, startDate, endDate, startMonthAmount, endMonthAmount }) => ({
      name: name.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      startMonthAmount: num(startMonthAmount),
      endMonthAmount: num(endMonthAmount),
    }));
}
