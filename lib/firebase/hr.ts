"use server";

import {
  fromFirestoreDoc,
  fromFirestoreDocs,
  stripLegacyFields,
  withTimestamps,
} from "@/lib/firebase/adapters";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { listAllDocs, newDocId } from "@/lib/firebase/query";
import type {
  AttendanceDoc,
  EmployeeDoc,
  LeaveRequest,
  MosqueAttendanceDoc,
  OvertimeRequest,
  OvertimeRequestEmployee,
  PrayerTimesDoc,
  PunchLogRaw,
  SalaryPeriodConfigDoc,
  SalarySlipDoc,
} from "@/lib/firebase/types";
import {
  getPayPeriodBounds,
  sanitizeHolidayDates,
} from "@/lib/salary-slips/pay-period";
import type { MosqueAttendanceRecord } from "@/types";
import {
  buildCouncilAttendanceEntry,
  isCouncilAttendanceEmployee,
  type CouncilAttendanceSyncResult,
} from "@/lib/attendance/council-attendance";
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

const BALANCE_LEAVES = new Set([
  "sickLeave",
  "certificateSickLeave",
  "annualLeave",
  "familyRelatedLeave",
]);

export type CouncilAttendanceSubmitItem = {
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  signInTime: string | null;
  leaveType: string | null;
  minutesLate: number;
  previousLeaveType: string | null;
  leaveDeducted: boolean;
};

function getNumericLeaveBalance(employee: EmployeeDoc, leaveType: string): number {
  const raw = employee[leaveType as keyof EmployeeDoc];
  return typeof raw === "number" && Number.isFinite(raw) ? (raw as number) : 0;
}

function applyLeaveBalanceDelta(
  employee: EmployeeDoc,
  leaveType: string,
  restore: boolean,
): number {
  const current = getNumericLeaveBalance(employee, leaveType);
  const isAdditive = ADDITIVE_LEAVES.has(leaveType);
  let next: number;

  if (isAdditive) {
    next = restore ? Math.max(0, current - 1) : current + 1;
  } else {
    if (!restore && current <= 0) {
      throw new Error("Insufficient leave balance");
    }
    next = restore ? current + 1 : current - 1;
  }

  (employee as Record<string, unknown>)[leaveType] = next;
  return next;
}

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
  const payload = withTimestamps(
    stripLegacyFields(employeeData as Record<string, unknown>),
    true,
  );
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
  const payload = withTimestamps(
    stripLegacyFields(formData as Record<string, unknown>),
  );

  if (Object.prototype.hasOwnProperty.call(formData, "creditSchemes")) {
    payload.creditScheme = FieldValue.delete();
  }

  await db.collection(COLLECTIONS.employees).doc(employeeId).update(payload);
  return fetchEmployeeById(employeeId);
}

export async function deleteEmployeeRecord(employeeId: string): Promise<void> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.employees).doc(employeeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Employee not found");
  }
  await ref.delete();
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
  const filteredEmployees = employees.filter(isCouncilAttendanceEmployee);

  const db = getFirestoreDb();
  const entries: Array<Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt">> =
    await Promise.all(
      filteredEmployees.map((employee) => buildCouncilAttendanceEntry(date, employee)),
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

export async function submitCouncilAttendanceUpdates(
  items: CouncilAttendanceSubmitItem[],
): Promise<void> {
  if (items.length === 0) return;

  const db = getFirestoreDb();
  const uniqueEmployeeIds = Array.from(
    new Set(items.map((item) => item.employeeId)),
  );
  const employeeRefs = uniqueEmployeeIds.map((id) =>
    db.collection(COLLECTIONS.employees).doc(id),
  );
  const employeeSnaps = await db.getAll(...employeeRefs);

  const employeeMap = new Map<string, EmployeeDoc>();
  for (const snap of employeeSnaps) {
    const employee = fromFirestoreDoc<EmployeeDoc>(snap);
    if (employee) {
      employeeMap.set(employee.$id, employee);
    }
  }

  const employeePatches: Record<string, Record<string, number>> = {};

  for (const item of items) {
    const employee = employeeMap.get(item.employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${item.employeeName}`);
    }

    const leaveType = item.leaveType ?? "";
    if (leaveType && BALANCE_LEAVES.has(leaveType)) {
      const available = getNumericLeaveBalance(employee, leaveType);
      if (available <= 0) {
        throw new Error(
          `${item.employeeName} does not have any ${leaveType} left.`,
        );
      }
    }

    if (item.previousLeaveType && item.previousLeaveType !== item.leaveType) {
      const next = applyLeaveBalanceDelta(
        employee,
        item.previousLeaveType,
        true,
      );
      employeePatches[item.employeeId] ??= {};
      employeePatches[item.employeeId][item.previousLeaveType] = next;
    }

    if (
      leaveType &&
      (!item.leaveDeducted || item.previousLeaveType !== item.leaveType)
    ) {
      const next = applyLeaveBalanceDelta(employee, leaveType, false);
      employeePatches[item.employeeId] ??= {};
      employeePatches[item.employeeId][leaveType] = next;
    }
  }

  let batch = db.batch();
  let operationCount = 0;

  const commitBatch = async () => {
    if (operationCount === 0) return;
    await batch.commit();
    batch = db.batch();
    operationCount = 0;
  };

  for (const [employeeId, fields] of Object.entries(employeePatches)) {
    if (operationCount >= 500) await commitBatch();
    batch.update(
      db.collection(COLLECTIONS.employees).doc(employeeId),
      withTimestamps(fields),
    );
    operationCount += 1;
  }

  for (const item of items) {
    if (operationCount >= 500) await commitBatch();
    batch.update(
      db.collection(COLLECTIONS.attendance).doc(item.attendanceId),
      withTimestamps({
        signInTime: item.signInTime,
        leaveType: item.leaveType,
        minutesLate: item.minutesLate,
        previousLeaveType: item.leaveType,
        leaveDeducted: Boolean(item.leaveType),
      }),
    );
    operationCount += 1;
  }

  await commitBatch();
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

/** Attendance for pay period (previous month 16 → period month 15). */
export async function fetchAttendanceForPayPeriod(
  periodLabel: string,
): Promise<AttendanceDoc[]> {
  const bounds = getPayPeriodBounds(periodLabel);
  if (!bounds) return [];

  return listAllDocs<AttendanceDoc>(COLLECTIONS.attendance, (q) =>
    q.where("date", ">=", bounds.startIso).where("date", "<=", bounds.endIso),
  );
}

export async function fetchSalaryPeriodConfig(
  periodLabel: string,
): Promise<SalaryPeriodConfigDoc | null> {
  const trimmed = periodLabel.trim();
  if (!trimmed) return null;

  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.salaryPeriodConfig)
    .doc(trimmed)
    .get();

  if (!snap.exists) return null;
  return fromFirestoreDoc<SalaryPeriodConfigDoc>(snap);
}

export async function upsertSalaryPeriodConfig(
  periodLabel: string,
  holidayDates: string[],
): Promise<SalaryPeriodConfigDoc> {
  const trimmed = periodLabel.trim();
  if (!trimmed || !/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error("Invalid period label");
  }

  const sanitized = sanitizeHolidayDates(trimmed, holidayDates);
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.salaryPeriodConfig).doc(trimmed);

  const payload = withTimestamps({
    periodLabel: trimmed,
    holidayDates: sanitized,
  });

  await ref.set(payload, { merge: true });

  const snap = await ref.get();
  return fromFirestoreDoc<SalaryPeriodConfigDoc>(snap)!;
}

export async function deleteAttendancesByDate(date: string): Promise<void> {
  const rows = await fetchAttendanceForDate(date);
  const db = getFirestoreDb();
  await Promise.all(
    rows.map((row) => db.collection(COLLECTIONS.attendance).doc(row.$id).delete()),
  );
}

export async function syncAttendanceForDate(
  date: string,
): Promise<CouncilAttendanceSyncResult> {
  const rows = await fetchAttendanceForDate(date);
  const employees = await fetchAllEmployees();
  const councilEmployees = employees.filter(isCouncilAttendanceEmployee);
  const existingIds = new Set(rows.map((row) => row.employeeId));
  const missingEmployees = councilEmployees.filter(
    (employee) => !existingIds.has(employee.$id),
  );

  const db = getFirestoreDb();
  let added = 0;

  await Promise.all(
    missingEmployees.map(async (employee) => {
      const entry = await buildCouncilAttendanceEntry(date, employee);
      const id = newDocId();
      await db
        .collection(COLLECTIONS.attendance)
        .doc(id)
        .set(withTimestamps(entry as Record<string, unknown>, true));
      added += 1;
    }),
  );

  const rowsToSync =
    missingEmployees.length > 0 ? await fetchAttendanceForDate(date) : rows;

  const nameById = new Map<string, string>();
  const deviceUserIdById = new Map<string, string>();
  for (const employee of employees) {
    nameById.set(employee.$id, employee.name);
    if (employee.deviceUserId?.trim()) {
      deviceUserIdById.set(employee.$id, employee.deviceUserId.trim());
    }
  }

  let synced = 0;
  await Promise.all(
    rowsToSync.map(async (row) => {
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
        synced += 1;
      }
    }),
  );

  return { synced, added };
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

export async function createOvertimeRequest(data: {
  details: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  employees: OvertimeRequestEmployee[];
}): Promise<OvertimeRequest> {
  const db = getFirestoreDb();
  const id = newDocId();
  const payload = withTimestamps(
    {
      ...data,
      createdAt: new Date().toISOString(),
      approvalStatus: "Pending",
    },
    true,
  );
  await db.collection(COLLECTIONS.overtimeRequests).doc(id).set(payload);
  return fromFirestoreDoc<OvertimeRequest>(
    await db.collection(COLLECTIONS.overtimeRequests).doc(id).get(),
  )!;
}

export async function fetchOvertimeRequests(
  limit = 10,
  offsetVal = 0,
): Promise<{ requests: OvertimeRequest[]; totalCount: number }> {
  const all = await listAllDocs<OvertimeRequest>(COLLECTIONS.overtimeRequests);
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

export async function updateOvertimeRequest(
  requestId: string,
  data: { approvalStatus: string; actionBy?: string },
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.overtimeRequests)
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

export async function upsertSalarySlipRecord(data: {
  recordCardNumber: string;
  employeeId?: string;
  periodLabel: string;
  objectKey: string;
  fileName?: string;
}): Promise<{ doc: SalarySlipDoc; replacedExisting: boolean }> {
  const trimmedRecord = data.recordCardNumber.trim();
  const trimmedPeriod = data.periodLabel.trim();
  const existing = (await listSalarySlipsByRecordCard(trimmedRecord)).find(
    (slip) => slip.periodLabel === trimmedPeriod,
  );

  if (existing) {
    const db = getFirestoreDb();
    const payload = withTimestamps(
      {
        recordCardNumber: trimmedRecord,
        employeeId: data.employeeId ?? existing.employeeId ?? null,
        periodLabel: trimmedPeriod,
        objectKey: data.objectKey,
        fileName: data.fileName ?? existing.fileName ?? null,
      },
      false,
    );
    await db.collection(COLLECTIONS.salarySlips).doc(existing.$id).update(payload);
    return {
      doc:
        fromFirestoreDoc<SalarySlipDoc>(
          await db.collection(COLLECTIONS.salarySlips).doc(existing.$id).get(),
        ) ?? existing,
      replacedExisting: true,
    };
  }

  const doc = await createSalarySlipRecord(data);
  return { doc, replacedExisting: false };
}

export type {
  AttendanceDoc,
  EmployeeDoc,
  LeaveRequest,
  MosqueAttendanceDoc,
  OvertimeRequest,
  PrayerTimesDoc,
  PunchLogRaw,
  SalarySlipDoc,
};
