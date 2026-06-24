export type RawZkRecord = Record<string, unknown>;

export type EmployeePunchMatch = {
  name: string;
  norm: string;
};

export type NormalizedPunch = {
  empId: string;
  empName: string | null;
  empNameNorm: string | null;
  timestamp: string;
  state: number;
  deviceSn: string;
  deviceUserId: string;
  dedupeKey: string;
  createdAt: string;
};

const DEVICE_TIMEZONE_OFFSETS: Record<string, number> = {
  "Indian/Maldives": 5 * 60,
};

export function normalizeHumanName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function pickDeviceUserId(record: RawZkRecord): string {
  return String(
    record.deviceUserId ??
      record.userId ??
      record.empId ??
      record.enrollNumber ??
      record.uid ??
      record.id ??
      record.userSn ??
      "",
  ).trim();
}

function getTimezoneOffsetMinutes(timezone: string): number {
  return DEVICE_TIMEZONE_OFFSETS[timezone] ?? -new Date().getTimezoneOffset();
}

function wallDateInTimezoneToIso(value: Date, timezone: string): string {
  const offsetMinutes = getTimezoneOffsetMinutes(timezone);
  const utcMs =
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    ) -
    offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function pickPunchTimestampIso(
  record: RawZkRecord,
  timezone: string,
): string | null {
  const raw =
    record.recordTime ?? record.attTime ?? record.timestamp ?? record.time ?? null;

  if (!raw) return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return wallDateInTimezoneToIso(raw, timezone);
  }

  const text = String(raw).trim();
  if (!text) return null;

  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const parsed = new Date(hasExplicitZone ? text : text.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;

  if (hasExplicitZone) return parsed.toISOString();
  return wallDateInTimezoneToIso(parsed, timezone);
}

export function makeDedupeKey(
  deviceSn: string,
  deviceUserId: string,
  timestampIso: string,
): string {
  const seconds = Math.floor(new Date(timestampIso).getTime() / 1000);
  return `${deviceSn || "unknown"}-${deviceUserId}-${seconds}`;
}

export function normalizePunch(
  record: RawZkRecord,
  options: {
    deviceSn: string;
    employee?: EmployeePunchMatch | null;
    timezone: string;
  },
): NormalizedPunch | null {
  const empId = pickDeviceUserId(record);
  if (!empId) return null;

  const timestamp = pickPunchTimestampIso(record, options.timezone);
  if (!timestamp || new Date(timestamp).getUTCFullYear() < 2020) return null;

  const stateRaw = Number(record.state ?? 0);
  const empName = options.employee?.name ?? null;

  return {
    empId,
    empName,
    empNameNorm: options.employee?.norm ?? (empName ? normalizeHumanName(empName) : null),
    timestamp,
    state: Number.isFinite(stateRaw) ? stateRaw : 0,
    deviceSn: options.deviceSn || "unknown",
    deviceUserId: empId,
    dedupeKey: makeDedupeKey(options.deviceSn || "unknown", empId, timestamp),
    createdAt: new Date().toISOString(),
  };
}
