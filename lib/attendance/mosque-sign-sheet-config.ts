export type ImamOptionKey =
  | "Shahidh"
  | "Zahidh"
  | "Umair"
  | "Neem"
  | "Yazaan"
  | "Ibraheem"
  | "Waseem";

export type SignatureConfig = {
  /** Single signature image; omit until the asset exists. */
  src?: string;
  /** Alternating Zahidh/Shahidh row signatures. */
  alternating?: boolean;
  /** Hide signature until a start date is chosen in the controls panel. */
  requiresStartDate?: boolean;
};

export const SIGNATURE_CONFIG: Partial<Record<ImamOptionKey, SignatureConfig>> =
  {
    Shahidh: { alternating: true },
    Zahidh: { alternating: true },
    Umair: { src: "/assets/images/umair.png" },
    Waseem: { src: "/assets/images/waseem-sign.png", requiresStartDate: true },
  };

export const SIGNATURE_HEIGHT_CLASSES: Partial<Record<ImamOptionKey, string>> =
  {
    Shahidh: "h-8",
    Zahidh: "h-8",
    Umair: "h-8",
    // waseem-sign.png is 1024×1024 with extra canvas padding; scale up to match others
    Waseem: "h-16",
  };

const SIG_SRC_ZAHIDH = "/assets/images/Zahidh-Sign.png";
const SIG_SRC_SHAHIDH = "/assets/images/Shahidh-Sign.png";

export const SIGNATURE_START_STORAGE_KEY =
  "mosque-sign-sheet-signature-starts";

export type SignatureStartDates = Partial<Record<ImamOptionKey, string>>;

export function loadSignatureStartDates(): SignatureStartDates {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SIGNATURE_START_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SignatureStartDates;
  } catch {
    return {};
  }
}

export function saveSignatureStartDates(dates: SignatureStartDates) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SIGNATURE_START_STORAGE_KEY, JSON.stringify(dates));
}

function alternatingSignatureForDay(day: number): string {
  return day % 2 === 1 ? SIG_SRC_ZAHIDH : SIG_SRC_SHAHIDH;
}

function signatureForImam(imamKey: ImamOptionKey): string | undefined {
  switch (imamKey) {
    case "Zahidh":
      return SIG_SRC_ZAHIDH;
    case "Shahidh":
      return SIG_SRC_SHAHIDH;
    default:
      return undefined;
  }
}

function isOnOrAfterStartDate(iso: string, startFrom?: string): boolean {
  if (!startFrom) return true;
  return iso >= startFrom;
}

export function resolveRowSignatureSrc(args: {
  imamKey: ImamOptionKey;
  iso: string;
  day: number;
  startFrom?: string;
}): string | undefined {
  const { imamKey, iso, day, startFrom } = args;

  const config = SIGNATURE_CONFIG[imamKey];
  if (!config) return undefined;

  if (config.requiresStartDate) {
    if (!startFrom) return undefined;
    if (!isOnOrAfterStartDate(iso, startFrom)) return undefined;
  }

  if (config.alternating) {
    return signatureForImam(imamKey) ?? alternatingSignatureForDay(day);
  }
  if (config.src) return config.src;

  return undefined;
}

export function imamRequiresSignatureStartDate(
  imamOptionKey: ImamOptionKey,
): boolean {
  return Boolean(SIGNATURE_CONFIG[imamOptionKey]?.requiresStartDate);
}

export function canConfigureSignatureStart(imamOptionKey: ImamOptionKey): boolean {
  return imamOptionKey in SIGNATURE_CONFIG;
}

export type PrayerCellRules = Record<number, Partial<Record<string, true>>>;

export function addPrayerCellRule(
  prev: PrayerCellRules,
  day: number,
  prayer: string | "ALL",
  allPrayerKeys: readonly string[],
): PrayerCellRules {
  const next: PrayerCellRules = { ...prev };
  const dayMap = { ...(next[day] ?? {}) };

  if (prayer === "ALL") {
    for (const key of allPrayerKeys) dayMap[key] = true;
  } else {
    dayMap[prayer] = true;
  }

  next[day] = dayMap;
  return next;
}

export function removePrayerCellRule(
  prev: PrayerCellRules,
  day: number,
  prayer: string | "ALL",
): PrayerCellRules {
  const existing = prev[day];
  if (!existing) return prev;

  const next: PrayerCellRules = { ...prev };
  const dayMap = { ...existing };

  if (prayer === "ALL") {
    delete next[day];
    return next;
  }

  delete dayMap[prayer];
  if (Object.keys(dayMap).length === 0) delete next[day];
  else next[day] = dayMap;

  return next;
}

export function hasPrayerCellRule(
  rules: PrayerCellRules,
  day: number,
  prayer: string,
): boolean {
  return !!rules[day]?.[prayer];
}

export function trimPrayerCellRules(
  rules: PrayerCellRules,
  maxDay: number,
): PrayerCellRules {
  const next: PrayerCellRules = {};
  for (const [k, v] of Object.entries(rules)) {
    const day = Number(k);
    if (day >= 1 && day <= maxDay) next[day] = v;
  }
  return next;
}
