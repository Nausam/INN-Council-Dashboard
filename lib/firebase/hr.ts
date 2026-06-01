"use server";

import {
  fromFirestoreDoc,
  fromFirestoreDocs,
  stripLegacyFields,
  withTimestamps,
} from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { listAllDocs, newDocId } from "@/lib/firebase/query";
import type {
  AttendanceDoc,
  EmployeeDoc,
  LeaveRequest,
  MosqueAttendanceDoc,
  PrayerTimesDoc,
  PunchLogRaw,
  SalarySlipDoc,
} from "@/lib/firebase/types";
import type { MosqueAttendanceRecord } from "@/types";
import {
  getFirstPunchByDeviceUserId,
  getFirstPunchByEmployeeName,
} from "@/lib/attendance/punch-lookup";
import {
  getPrefilledMosqueSignInTimes,
  type MosquePrayerTimes,
} from "@/lib/attendance/mosque-prefill";

const ADDITIVE_LEAVES = new Set([
  "maternityLeave",
  "preMaternityLeave",
  "paternityLeave",
  "noPayLeave",
  "officialLeave",
]);

export async function fetchAllEmployees(): Promise<EmployeeDoc[]> {
  return listAllDocs<EmployeeDoc>(COLLECTIONS.employees);
}

export async function createEmployeeRecord(
  employeeData: Partial<Omit<EmployeeDoc, "$id" | "$createdAt" | "$updatedAt">> & {
    name: string;
  },
): Promise<EmployeeDoc> {
  const db = getFirestoreDb();
  const id = newDocId();
  const payload = withTimestamps(stripLegacyFields(employeeData as Record<string, unknown>), true);
  await db.collection(COLLECTIONS.employees).doc(id).set(payload);
  const snap = await db.collection(COLLECTIONS.employees).doc(id).get();
  return fromFirestoreDoc<EmployeeDoc>(snap)!;
}

export async function fetchEmployeeById(employeeId: string): Promise<EmployeeDoc> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.employees)
    .doc(employeeId)
    .get();
  const doc = fromFirestoreDoc<EmployeeDoc>(snap);
  if (!doc) throw new Error("Employee not found");
  return doc;
}

export async function fetchEmployeeByRecordCardNumber(
  recordCardNumber: string,
): Promise<EmployeeDoc | null> {
  const trimmed = recordCardNumber.trim();
  if (!trimmed) return null;
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.employees)
    .where("recordCardNumber", "==", trimmed)
    .limit(1)
    .get();
  return snap.empty ? null : fromFirestoreDoc<EmployeeDoc>(snap.docs[0]!)!;
}

export async function deductLeave(
  employeeId: string,
  leaveType: string,
  restore = false,
): Promise<void> {
  const employee = await fetchEmployeeById(employeeId);
  const raw = employee[leaveType as keyof EmployeeDoc];
  const current =
    typeof raw === "number" && Number.isFinite(raw) ? (raw as number) : 0;
  const isAdditive = ADDITIVE_LEAVES.has(leaveType);
  let next: number;

  if (isAdditive) {
    next = restore ? Math.max(0, current - 1) : current + 1;
  } else {
    if (!restore && current <= 0) throw new Error("Insufficient leave balance");
    next = restore ? current + 1 : current - 1;
  }

  await getFirestoreDb()
    .collection(COLLECTIONS.employees)
    .doc(employeeId)
    .update(withTimestamps({ [leaveType]: next }));
}

export async function updateEmployeeLeaveBalance(
  employeeId: string,
  updatedLeaveData: Partial<Omit<EmployeeDoc, "$id" | "$createdAt" | "$updatedAt">>,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.employees)
    .doc(employeeId)
    .update(withTimestamps(stripLegacyFields(updatedLeaveData as Record<string, unknown>)));
}

export async function updateEmployeeRecord(
  employeeId: string,
  formData: Partial<Omit<EmployeeDoc, "$id" | "$createdAt" | "$updatedAt">>,
): Promise<EmployeeDoc> {
  const db = getFirestoreDb();
  await db
    .collection(COLLECTIONS.employees)
    .doc(employeeId)
    .update(withTimestamps(stripLegacyFields(formData as Record<string, unknown>)));
  return fetchEmployeeById(employeeId);
}

export async function fetchMosqueAssistants(): Promise<EmployeeDoc[]> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.employees)
    .where("designation", "==", "Mosque Assistant")
    .get();
  return fromFirestoreDocs<EmployeeDoc>(snap.docs);
}

export async function fetchAttendanceForDate(date: string): Promise<AttendanceDoc[]> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.attendance)
    .where("date", "==", date)
    .get();
  return fromFirestoreDocs<AttendanceDoc>(snap.docs);
}

export async function createAttendanceForEmployees(
  date: string,
  employees: EmployeeDoc[],
): Promise<Array<Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt">>> {
  const filteredEmployees = employees.filter((e) => {
    const sec =
      typeof e.section === "string" ? e.section.trim().toLowerCase() : "";
    return sec !== "mosque";
  });

  const db = getFirestoreDb();
  const entries: Array<Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt">> =
    await Promise.all(
      filteredEmployees.map(async (employee) => {
        const firstPunch = employee.deviceUserId?.trim()
          ? await getFirstPunchByDeviceUserId(date, employee.deviceUserId.trim())
          : await getFirstPunchByEmployeeName(date, employee.name);
        return {
          employeeId: employee.$id,
          date,
          signInTime: firstPunch,
          leaveType: null,
          minutesLate: 0,
          previousLeaveType: null,
          leaveDeducted: false,
        };
      }),
    );

  await Promise.all(
    entries.map(async (entry) => {
      const id = newDocId();
      await db
        .collection(COLLECTIONS.attendance)
        .doc(id)
        .set(withTimestamps(entry as Record<string, unknown>, true));
    }),
  );

  return entries;
}

export async function updateAttendanceRecord(
  attendanceId: string,
  updates: Partial<
    Pick<
      AttendanceDoc,
      | "signInTime"
      | "leaveType"
      | "minutesLate"
      | "leaveDeducted"
      | "previousLeaveType"
    >
  >,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.attendance)
    .doc(attendanceId)
    .update(withTimestamps(updates as Record<string, unknown>));
}

export async function fetchAttendanceForMonth(month: string): Promise<AttendanceDoc[]> {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const start = `${month}-01`;

  return listAllDocs<AttendanceDoc>(COLLECTIONS.attendance, (q) =>
    q.where("date", ">=", start).where("date", "<", end),
  );
}

export async function deleteAttendancesByDate(date: string): Promise<void> {
  const rows = await fetchAttendanceForDate(date);
  const db = getFirestoreDb();
  await Promise.all(
    rows.map((row) => db.collection(COLLECTIONS.attendance).doc(row.$id).delete()),
  );
}

export async function syncAttendanceForDate(date: string): Promise<number> {
  const rows = await fetchAttendanceForDate(date);
  if (rows.length === 0) return 0;

  const employees = await fetchAllEmployees();
  const nameById = new Map<string, string>();
  const deviceUserIdById = new Map<string, string>();
  for (const e of employees) {
    nameById.set(e.$id, e.name);
    if (e.deviceUserId?.trim()) deviceUserIdById.set(e.$id, e.deviceUserId.trim());
  }

  let changed = 0;
  await Promise.all(
    rows.map(async (row) => {
      const deviceUserId = deviceUserIdById.get(row.employeeId);
      const empName = nameById.get(row.employeeId);
      const earliest = deviceUserId
        ? await getFirstPunchByDeviceUserId(date, deviceUserId)
        : null;
      const earliestByName =
        earliest ??
        (empName ? await getFirstPunchByEmployeeName(date, empName) : null);
      if (!earliestByName) return;

      const current = row.signInTime ? new Date(row.signInTime).getTime() : null;
      const earliestMs = new Date(earliestByName).getTime();
      if (current === null || earliestMs < current) {
        await updateAttendanceRecord(row.$id, { signInTime: earliestByName });
        changed += 1;
      }
    }),
  );
  return changed;
}

export async function fetchMosqueAttendanceForDate(
  date: string,
): Promise<MosqueAttendanceDoc[]> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.mosqueAttendance)
    .where("date", "==", date)
    .get();
  return fromFirestoreDocs<MosqueAttendanceDoc>(snap.docs);
}

export async function createMosqueAttendanceForEmployees(
  date: string,
  employees: EmployeeDoc[],
  prayerTimes?: MosquePrayerTimes | null,
): Promise<Array<Omit<MosqueAttendanceDoc, "$id" | "$createdAt" | "$updatedAt">>> {
  const entries = employees.map((employee) => {
    const prefilledTimes = prayerTimes
      ? getPrefilledMosqueSignInTimes(
          employee.designation || "",
          prayerTimes,
          date,
        )
      : null;

    return {
      employeeId: employee.$id,
      date,
      fathisSignInTime: prefilledTimes?.fathisSignInTime || null,
      mendhuruSignInTime: prefilledTimes?.mendhuruSignInTime || null,
      asuruSignInTime: prefilledTimes?.asuruSignInTime || null,
      maqribSignInTime: prefilledTimes?.maqribSignInTime || null,
      ishaSignInTime: prefilledTimes?.ishaSignInTime || null,
      leaveType: null,
      previousLeaveType: null,
      leaveDeducted: false,
      changed: false,
      fathisMinutesLate: 0,
      mendhuruMinutesLate: 0,
      asuruMinutesLate: 0,
      maqribMinutesLate: 0,
      ishaMinutesLate: 0,
    };
  });

  const db = getFirestoreDb();
  await Promise.all(
    entries.map(async (entry) => {
      const id = newDocId();
      await db
        .collection(COLLECTIONS.mosqueAttendance)
        .doc(id)
        .set(withTimestamps(entry as Record<string, unknown>, true));
    }),
  );

  return entries;
}

export async function updateMosqueAttendanceRecord(
  attendanceId: string,
  updates: Partial<MosqueAttendanceRecord>,
): Promise<MosqueAttendanceDoc> {
  const db = getFirestoreDb();
  await db
    .collection(COLLECTIONS.mosqueAttendance)
    .doc(attendanceId)
    .update(withTimestamps(updates as Record<string, unknown>));
  const snap = await db.collection(COLLECTIONS.mosqueAttendance).doc(attendanceId).get();
  return fromFirestoreDoc<MosqueAttendanceDoc>(snap)!;
}

export async function savePrayerTimes(
  prayerTimes: Omit<PrayerTimesDoc, "$id" | "$createdAt" | "$updatedAt">,
): Promise<PrayerTimesDoc> {
  const db = getFirestoreDb();
  const id = newDocId();
  await db
    .collection(COLLECTIONS.prayerTimes)
    .doc(id)
    .set(withTimestamps(prayerTimes as Record<string, unknown>, true));
  return fromFirestoreDoc<PrayerTimesDoc>(
    await db.collection(COLLECTIONS.prayerTimes).doc(id).get(),
  )!;
}

export async function updatePrayerTimes(
  recordId: string,
  updatedTimes: Partial<
    Pick<
      PrayerTimesDoc,
      "fathisTime" | "mendhuruTime" | "asuruTime" | "maqribTime" | "ishaTime"
    >
  >,
): Promise<PrayerTimesDoc> {
  const db = getFirestoreDb();
  await db
    .collection(COLLECTIONS.prayerTimes)
    .doc(recordId)
    .update(withTimestamps(updatedTimes as Record<string, unknown>));
  return fromFirestoreDoc<PrayerTimesDoc>(
    await db.collection(COLLECTIONS.prayerTimes).doc(recordId).get(),
  )!;
}

export async function fetchPrayerTimesByDate(
  date: string,
): Promise<PrayerTimesDoc | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.prayerTimes)
    .where("date", "==", date)
    .limit(1)
    .get();
  return snap.empty ? null : fromFirestoreDoc<PrayerTimesDoc>(snap.docs[0]!)!;
}

export async function fetchPrayerTimesForMonth(
  month: string,
): Promise<PrayerTimesDoc[]> {
  const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
  const endOfMonth = new Date(
    new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1),
  ).toISOString();

  return listAllDocs<PrayerTimesDoc>(COLLECTIONS.prayerTimes, (q) =>
    q.where("date", ">=", startOfMonth).where("date", "<=", endOfMonth),
  );
}

export async function fetchMosqueAttendanceForMonth(
  month: string,
): Promise<MosqueAttendanceDoc[]> {
  const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
  const endOfMonth = new Date(
    new Date(`${month}-01T00:00:00Z`).setMonth(
      new Date(`${month}-01`).getMonth() + 1,
    ),
  ).toISOString();

  return listAllDocs<MosqueAttendanceDoc>(COLLECTIONS.mosqueAttendance, (q) =>
    q.where("date", ">=", startOfMonth).where("date", "<=", endOfMonth),
  );
}

export async function fetchMosqueDailyAttendanceForMonth(
  month: string,
  employeeId: string,
): Promise<MosqueAttendanceDoc[]> {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth =
    m === 12
      ? `${y + 1}-01`
      : `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthEndExclusive = `${nextMonth}-01`;

  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.mosqueAttendance)
    .where("employeeId", "==", employeeId)
    .get();

  return fromFirestoreDocs<MosqueAttendanceDoc>(snap.docs).filter((row) => {
    const d = String(row.date ?? "");
    return d >= monthStart && d < monthEndExclusive;
  });
}

export async function deleteMosqueAttendancesByDate(date: string): Promise<void> {
  const rows = await fetchMosqueAttendanceForDate(date);
  const db = getFirestoreDb();
  await Promise.all(
    rows.map((row) =>
      db.collection(COLLECTIONS.mosqueAttendance).doc(row.$id).delete(),
    ),
  );
}

export async function createLeaveRequest(leaveRequestData: {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
}): Promise<LeaveRequest> {
  const db = getFirestoreDb();
  const id = newDocId();
  const payload = withTimestamps(
    {
      ...leaveRequestData,
      createdAt: new Date().toISOString(),
      approvalStatus: "Pending",
    },
    true,
  );
  await db.collection(COLLECTIONS.leaveRequests).doc(id).set(payload);
  return fromFirestoreDoc<LeaveRequest>(
    await db.collection(COLLECTIONS.leaveRequests).doc(id).get(),
  )!;
}

export async function fetchLeaveRequests(
  limit = 10,
  offsetVal = 0,
): Promise<{ requests: LeaveRequest[]; totalCount: number }> {
  const all = await listAllDocs<LeaveRequest>(COLLECTIONS.leaveRequests);
  all.sort((a, b) =>
    String(b.createdAt ?? b.$createdAt ?? "").localeCompare(
      String(a.createdAt ?? a.$createdAt ?? ""),
    ),
  );
  return {
    requests: all.slice(offsetVal, offsetVal + limit),
    totalCount: all.length,
  };
}

export async function updateLeaveRequest(
  requestId: string,
  data: { approvalStatus: string; actionBy?: string },
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.leaveRequests)
    .doc(requestId)
    .update(withTimestamps(data as Record<string, unknown>));
}

export async function fetchUserLeaveRequests(
  status?: string,
  limit = 10,
  offsetVal = 0,
): Promise<{ requests: LeaveRequest[]; totalCount: number }> {
  let all = await listAllDocs<LeaveRequest>(COLLECTIONS.leaveRequests);
  if (status) all = all.filter((r) => r.approvalStatus === status);
  all.sort((a, b) =>
    String(b.createdAt ?? b.$createdAt ?? "").localeCompare(
      String(a.createdAt ?? a.$createdAt ?? ""),
    ),
  );
  return {
    requests: all.slice(offsetVal, offsetVal + limit),
    totalCount: all.length,
  };
}

export async function listSalarySlipsByRecordCard(
  recordCardNumber: string,
): Promise<SalarySlipDoc[]> {
  const trimmed = recordCardNumber.trim();
  if (!trimmed) return [];
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.salarySlips)
    .where("recordCardNumber", "==", trimmed)
    .limit(100)
    .get();
  const slips = fromFirestoreDocs<SalarySlipDoc>(snap.docs);
  return slips.sort((a, b) => b.periodLabel.localeCompare(a.periodLabel));
}

export async function listRecordCardNumbersWithSlipForPeriod(
  periodLabel: string,
): Promise<string[]> {
  const trimmed = periodLabel.trim();
  if (!trimmed) return [];
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.salarySlips)
    .where("periodLabel", "==", trimmed)
    .limit(500)
    .get();
  const set = new Set<string>();
  for (const doc of snap.docs) {
    const rc = doc.data().recordCardNumber;
    if (typeof rc === "string" && rc.trim()) set.add(rc.trim());
  }
  return Array.from(set);
}

export async function createSalarySlipRecord(data: {
  recordCardNumber: string;
  employeeId?: string;
  periodLabel: string;
  objectKey: string;
  fileName?: string;
}): Promise<SalarySlipDoc> {
  const db = getFirestoreDb();
  const id = newDocId();
  const payload = withTimestamps(
    {
      recordCardNumber: data.recordCardNumber.trim(),
      employeeId: data.employeeId ?? null,
      periodLabel: data.periodLabel,
      objectKey: data.objectKey,
      fileName: data.fileName ?? null,
    },
    true,
  );
  await db.collection(COLLECTIONS.salarySlips).doc(id).set(payload);
  return fromFirestoreDoc<SalarySlipDoc>(
    await db.collection(COLLECTIONS.salarySlips).doc(id).get(),
  )!;
}

export type {
  AttendanceDoc,
  EmployeeDoc,
  LeaveRequest,
  MosqueAttendanceDoc,
  PrayerTimesDoc,
  PunchLogRaw,
  SalarySlipDoc,
};
