import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

const normalizeHumanName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const MV_OFFSET_MIN = 5 * 60;
const COUNCIL_PUNCH_START_HOUR = 6;
const COUNCIL_PUNCH_END_HOUR = 9;

const localTimeRangeToUtc = (
  yyyyMmDd: string,
  startHour: number,
  endHour: number,
) => {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const startUtc = new Date(
    Date.UTC(year, month - 1, day, startHour, 0, 0, 0) -
      MV_OFFSET_MIN * 60 * 1000,
  ).toISOString();
  const endUtc = new Date(
    Date.UTC(year, month - 1, day, endHour, 0, 0, 0) -
      MV_OFFSET_MIN * 60 * 1000,
  ).toISOString();
  return { startUtc, endUtc };
};

function punchTimeIso(
  data: DocumentData,
  field: "timestamp" | "createdAt",
): string | null {
  const value = data[field];
  if (value instanceof Date) return value.toISOString();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value ? String(value) : null;
}

function punchTimestampIso(data: DocumentData): string | null {
  return punchTimeIso(data, "timestamp") ?? punchTimeIso(data, "createdAt");
}

async function firstPunchByIndexedField(
  field: "deviceUserId" | "empNameNorm" | "empName",
  value: string,
  startUtc: string,
  endUtc: string,
): Promise<string | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .where(field, "==", value)
    .where("timestamp", ">=", startUtc)
    .where("timestamp", "<", endUtc)
    .orderBy("timestamp", "asc")
    .limit(1)
    .get();

  for (const doc of snap.docs) {
    const iso = punchTimestampIso(doc.data());
    if (iso) return iso;
  }

  return null;
}

function councilPunchWindowUtc(localDate: string) {
  return localTimeRangeToUtc(
    localDate,
    COUNCIL_PUNCH_START_HOUR,
    COUNCIL_PUNCH_END_HOUR,
  );
}

/** First council punch between 06:00 and 09:00 Maldives time. */
export async function getFirstPunchByDeviceUserId(
  localDate: string,
  deviceUserId: string,
): Promise<string | null> {
  const trimmed = String(deviceUserId).trim();
  if (!trimmed) return null;

  const { startUtc, endUtc } = councilPunchWindowUtc(localDate);
  return firstPunchByIndexedField("deviceUserId", trimmed, startUtc, endUtc);
}

/** First council punch between 06:00 and 09:00 matched by normalized/exact name. */
export async function getFirstPunchByEmployeeName(
  localDate: string,
  employeeName: string,
): Promise<string | null> {
  const { startUtc, endUtc } = councilPunchWindowUtc(localDate);
  const nameNorm = normalizeHumanName(employeeName);

  for (const [field, value] of [
    ["empNameNorm", nameNorm],
    ["empName", employeeName],
  ] as const) {
    const earliest = await firstPunchByIndexedField(
      field,
      value,
      startUtc,
      endUtc,
    );
    if (earliest) return earliest;
  }

  return null;
}
