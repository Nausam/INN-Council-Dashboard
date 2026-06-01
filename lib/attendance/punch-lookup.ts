import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

const normalizeHumanName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const localDayRangeToUtc = (yyyyMmDd: string) => {
  const startLocal = new Date(`${yyyyMmDd}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  const startUtc = new Date(
    startLocal.getTime() - startLocal.getTimezoneOffset() * 60000,
  ).toISOString();
  const endUtc = new Date(
    endLocal.getTime() - endLocal.getTimezoneOffset() * 60000,
  ).toISOString();
  return { startUtc, endUtc };
};

function punchTimeIso(
  data: DocumentData,
  field: "timestamp" | "createdAt",
): string | null {
  if (field === "timestamp") {
    const ts = data.timestamp;
    return ts ? String(ts) : null;
  }
  const createdAt = data.createdAt;
  if (createdAt instanceof Date) return createdAt.toISOString();
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "toDate" in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === "function"
  ) {
    return (createdAt as { toDate: () => Date }).toDate().toISOString();
  }
  return createdAt ? String(createdAt) : null;
}

function earliestInDayRange(
  docs: QueryDocumentSnapshot[],
  startUtc: string,
  endUtc: string,
): string | null {
  const times: string[] = [];
  for (const doc of docs) {
    const data = doc.data();
    for (const field of ["timestamp", "createdAt"] as const) {
      const iso = punchTimeIso(data, field);
      if (iso && iso >= startUtc && iso < endUtc) times.push(iso);
    }
  }
  if (times.length === 0) return null;
  times.sort();
  return times[0]!;
}

/** First punch of the day for a biometric device user id (no composite index required). */
export async function getFirstPunchByDeviceUserId(
  localDate: string,
  deviceUserId: string,
): Promise<string | null> {
  const trimmed = String(deviceUserId).trim();
  if (!trimmed) return null;

  const { startUtc, endUtc } = localDayRangeToUtc(localDate);
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.punchLogs)
    .where("deviceUserId", "==", trimmed)
    .get();

  return earliestInDayRange(snap.docs, startUtc, endUtc);
}

/** First punch of the day matched by normalized or exact employee name. */
export async function getFirstPunchByEmployeeName(
  localDate: string,
  employeeName: string,
): Promise<string | null> {
  const { startUtc, endUtc } = localDayRangeToUtc(localDate);
  const col = getFirestoreDb().collection(COLLECTIONS.punchLogs);
  const nameNorm = normalizeHumanName(employeeName);

  for (const [field, value] of [
    ["empNameNorm", nameNorm],
    ["empName", employeeName],
  ] as const) {
    const snap = await col.where(field, "==", value).get();
    const earliest = earliestInDayRange(snap.docs, startUtc, endUtc);
    if (earliest) return earliest;
  }

  return null;
}
