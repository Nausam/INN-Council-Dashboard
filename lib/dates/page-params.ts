import { todayMaldivesIso } from "@/lib/attendance-sync/time";

export function dateFromSearchParam(value?: string | string[] | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayMaldivesIso();
}

export function monthFromSearchParam(value?: string | string[] | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return todayMaldivesIso().slice(0, 7);
}

export function searchParamString(value?: string | string[] | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
