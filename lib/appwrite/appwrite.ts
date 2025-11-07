import { MosqueAttendanceRecord } from "@/types";
import { Account, Client, Databases, ID, Models, Query } from "appwrite";

/* =============================== Config =============================== */

export const appwriteConfig = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "68fafb190023ef05bc17",
  databaseId: "68fafc1000231aecbf69",
  employeesCollectionId: "6708bd860020db2f8598",
  attendanceCollectionId: "6701373d00373ea0dd09",
  mosqueAttendanceCollectionId: "6748841b0005589c9c31",
  prayerTimesCollectionId: "6749573400305f49417b",
  leaveRequestsCollectionId: "674ee238003517f3004d",
  wasteManagementFormsId: "6784e0610000e598d1e6",
  punchLogsRawCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_PUNCH_LOGS_RAW_COLLECTION ?? "",
};

const {
  endpoint,
  projectId,
  databaseId,
  employeesCollectionId,
  attendanceCollectionId,
  mosqueAttendanceCollectionId,
} = appwriteConfig;

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);
const databases = new Databases(client);

/* =============================== Types =============================== */

// Leave request doc
export type LeaveRequest = Models.Document & {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string; // ISO
  endDate: string; // ISO
  approvalStatus: string;
  createdAt?: string; // you set this on create
};

// Employee doc (common fields + known leave balances)
export type EmployeeDoc = Models.Document & {
  name: string;
  designation?: string;
  section?: string;

  // known leave counters (optional – not all employees will have all keys)
  sickLeave?: number;
  certificateSickLeave?: number;
  annualLeave?: number;
  familyRelatedLeave?: number;
  maternityLeave?: number;
  preMaternityLeave?: number;
  paternityLeave?: number;
  noPayLeave?: number;
  officialLeave?: number;

  // allow extra custom numeric leave fields without using any
  [key: string]: unknown;
};

// Office attendance doc
export type AttendanceDoc = Models.Document & {
  employeeId: string; // FK to employee $id
  date: string; // ISO date (YYYY-MM-DD or ISO datetime)
  signInTime: string | null; // ISO datetime (UTC)
  leaveType: string | null;
  minutesLate: number;
  previousLeaveType?: string | null;
  leaveDeducted?: boolean;
};

// Mosque attendance doc (merge your UI type with Document)
export type MosqueAttendanceDoc = Models.Document & MosqueAttendanceRecord;

// Prayer times doc
export type PrayerTimesDoc = Models.Document & {
  date: string; // ISO YYYY-MM-DD
  fathisTime: string; // "HH:mm"
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

const ADDITIVE_LEAVES = new Set([
  "maternityLeave",
  "preMaternityLeave",
  "paternityLeave",
  "noPayLeave",
  "officialLeave",
]);

/* -------- Punch logs raw -------- */

const normalizeHumanName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Convert a local YYYY-MM-DD to UTC ISO range covering that local day.
const localDayRangeToUtc = (yyyyMmDd: string) => {
  const startLocal = new Date(`${yyyyMmDd}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  const startUtc = new Date(
    startLocal.getTime() - startLocal.getTimezoneOffset() * 60000
  ).toISOString();
  const endUtc = new Date(
    endLocal.getTime() - endLocal.getTimezoneOffset() * 60000
  ).toISOString();
  return { startUtc, endUtc };
};

type PunchLogRaw = Models.Document & {
  empId?: string;
  empName?: string;
  empNameNorm?: string; // stored in your collector
  timestamp?: string | null; // optional; we will rely on $createdAt
  state?: number; // 0/1 from device (ignored for now)
  deviceSn?: string;
  deviceUserId?: string;
  dedupeKey?: string;
};

/* =============================== Attendance (Office) =============================== */

/** Earliest $createdAt for an employee on a given UTC date (YYYY-MM-DD). */
const getFirstPunchCreatedAtForEmployee = async (
  localDate: string,
  employeeName: string
): Promise<string | null> => {
  const { startUtc, endUtc } = localDayRangeToUtc(localDate);
  const nameNorm = normalizeHumanName(employeeName);

  // 1) try strict match on normalized field
  let res = await databases.listDocuments<PunchLogRaw>(
    appwriteConfig.databaseId,
    appwriteConfig.punchLogsRawCollectionId,
    [
      Query.equal("empNameNorm", nameNorm),
      Query.greaterThanEqual("timestamp", startUtc),
      Query.lessThan("timestamp", endUtc),
      Query.orderAsc("timestamp"),
      Query.limit(1),
    ]
  );
  if (res.documents.length) return res.documents[0].timestamp!;

  // 2) fall back to exact name on `timestamp`
  res = await databases.listDocuments<PunchLogRaw>(
    appwriteConfig.databaseId,
    appwriteConfig.punchLogsRawCollectionId,
    [
      Query.equal("empName", employeeName),
      Query.greaterThanEqual("timestamp", startUtc),
      Query.lessThan("timestamp", endUtc),
      Query.orderAsc("timestamp"),
      Query.limit(1),
    ]
  );
  if (res.documents.length) return res.documents[0].timestamp!;

  // 3) last resort: use $createdAt window (in case timestamp was not set)
  res = await databases.listDocuments<PunchLogRaw>(
    appwriteConfig.databaseId,
    appwriteConfig.punchLogsRawCollectionId,
    [
      Query.equal("empNameNorm", nameNorm),
      Query.greaterThanEqual("$createdAt", startUtc),
      Query.lessThan("$createdAt", endUtc),
      Query.orderAsc("$createdAt"),
      Query.limit(1),
    ]
  );
  if (res.documents.length) return res.documents[0].$createdAt;

  return null;
};

export const syncAttendanceForDate = async (date: string): Promise<number> => {
  // 1) Get attendance rows for the day (paginate just in case)
  const rows = await fetchAttendanceForDate(date);

  if (rows.length === 0) return 0;

  // 2) Build a map of employeeId -> name once
  const employees = await fetchAllEmployees();
  const nameById = new Map<string, string>();
  for (const e of employees) nameById.set(e.$id, e.name);

  // 3) For each row, resolve earliest punch and update if needed
  let changed = 0;

  await Promise.all(
    rows.map(async (row) => {
      const empName = nameById.get(row.employeeId);
      if (!empName) return;

      const earliest = await getFirstPunchCreatedAtForEmployee(date, empName);
      if (!earliest) return;

      const current = row.signInTime
        ? new Date(row.signInTime).getTime()
        : null;
      const earliestMs = new Date(earliest).getTime();

      if (current === null || earliestMs < current) {
        await updateAttendanceRecord(row.$id, { signInTime: earliest });
        changed += 1;
      }
    })
  );

  return changed;
};
// Fetch attendance for a given date
export const fetchAttendanceForDate = async (
  date: string
): Promise<AttendanceDoc[]> => {
  try {
    const response = await databases.listDocuments<AttendanceDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching attendance:", error);
    throw error;
  }
};

// Fetch all employees
export const fetchAllEmployees = async (): Promise<EmployeeDoc[]> => {
  const results: EmployeeDoc[] = [];
  const pageSize = 100; // Appwrite max per page
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const res = await databases.listDocuments<EmployeeDoc>(
        appwriteConfig.databaseId,
        appwriteConfig.employeesCollectionId,
        [Query.limit(pageSize), Query.offset(offset)]
      );

      results.push(...res.documents);
      hasMore = res.documents.length === pageSize;
      offset += pageSize;
    }

    return results;
  } catch (err) {
    console.error("Error fetching employees:", err);
    throw err;
  }
};

// Create attendance for all employees (excluding mosque assistants)
export const createAttendanceForEmployees = async (
  date: string,
  employees: EmployeeDoc[]
): Promise<Array<Omit<AttendanceDoc, keyof Models.Document>>> => {
  try {
    // exclude whole Mosque section (unchanged)
    const filteredEmployees = employees.filter((e) => {
      const sec =
        typeof e.section === "string" ? e.section.trim().toLowerCase() : "";
      return sec !== "mosque";
    });

    // Build entries with real sign-in times
    const attendanceEntries: Array<Omit<AttendanceDoc, keyof Models.Document>> =
      await Promise.all(
        filteredEmployees.map(async (employee) => {
          const firstPunch = await getFirstPunchCreatedAtForEmployee(
            date,
            employee.name
          );

          return {
            employeeId: employee.$id,
            date,
            signInTime: firstPunch, // ← from $createdAt (or null if none)
            leaveType: null,
            minutesLate: 0, // keep your current calc pipeline
            previousLeaveType: null,
            leaveDeducted: false,
          };
        })
      );

    // Write all rows
    await Promise.all(
      attendanceEntries.map((entry) =>
        databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.attendanceCollectionId,
          ID.unique(),
          entry
        )
      )
    );

    return attendanceEntries;
  } catch (error) {
    console.error("Error creating attendance:", error);
    throw error;
  }
};

// Update attendance record
export const updateAttendanceRecord = async (
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
  >
): Promise<void> => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      attendanceId,
      updates
    );
  } catch (error) {
    console.error("Error updating attendance:", error);
    throw error;
  }
};

// Fetch attendance for the month
export const fetchAttendanceForMonth = async (
  month: string
): Promise<AttendanceDoc[]> => {
  // month is "YYYY-MM"
  const start = `${month}-01`; // same format as stored in documents
  // build end as the first day of next month in the same "YYYY-MM-DD" format
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // next month, day 1
  const end = `${next.getUTCFullYear()}-${String(
    next.getUTCMonth() + 1
  ).padStart(2, "0")}-01`;

  const results: AttendanceDoc[] = [];
  let hasMore = true;
  let offset = 0;
  const limit = 100;

  try {
    while (hasMore) {
      const resp = await databases.listDocuments<AttendanceDoc>(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        [
          Query.greaterThanEqual("date", start),
          Query.lessThan("date", end), // strictly less than first day of next month
          Query.limit(limit),
          Query.offset(offset),
        ]
      );
      results.push(...resp.documents);
      hasMore = resp.documents.length === limit;
      offset += hasMore ? limit : 0;
    }
    return results;
  } catch (err) {
    console.error("Error fetching attendance for the month:", err);
    throw err;
  }
};

/* =============================== Employees =============================== */

// Create employee record
export const createEmployeeRecord = async (
  employeeData: Partial<Omit<EmployeeDoc, keyof Models.Document>> & {
    name: string;
  }
): Promise<EmployeeDoc> => {
  try {
    const response = await databases.createDocument<EmployeeDoc>(
      databaseId,
      employeesCollectionId,
      ID.unique(),
      employeeData
    );
    return response;
  } catch (error) {
    console.error("Error creating employee:", error);
    throw error;
  }
};

// Fetch employee by ID
export const fetchEmployeeById = async (
  employeeId: string
): Promise<EmployeeDoc> => {
  try {
    const response = await databases.getDocument<EmployeeDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.employeesCollectionId,
      employeeId
    );
    return response;
  } catch (error) {
    console.error("Error fetching employee:", error);
    throw error;
  }
};

// Fetch the employee's current leave and update it by deducting/restoring one
export const deductLeave = async (
  employeeId: string,
  leaveType: string,
  restore = false
): Promise<void> => {
  const employee = await fetchEmployeeById(employeeId);

  // current value; treat undefined/null as 0
  const raw = employee[leaveType as keyof EmployeeDoc];
  const current =
    typeof raw === "number" && Number.isFinite(raw) ? (raw as number) : 0;

  const isAdditive = ADDITIVE_LEAVES.has(leaveType);

  let next: number;

  if (isAdditive) {
    // Counters: +1 when applying, -1 when restoring
    next = restore ? Math.max(0, current - 1) : current + 1;
  } else {
    // Balances: -1 when applying, +1 when restoring
    if (!restore && current <= 0) {
      throw new Error("Insufficient leave balance");
    }
    next = restore ? current + 1 : current - 1;
  }

  await databases.updateDocument(
    databaseId,
    employeesCollectionId,
    employeeId,
    { [leaveType]: next }
  );
};
// Update employee's leave balance
export const updateEmployeeLeaveBalance = async (
  employeeId: string,
  updatedLeaveData: Partial<Omit<EmployeeDoc, keyof Models.Document>>
): Promise<void> => {
  try {
    await databases.updateDocument(
      databaseId,
      employeesCollectionId,
      employeeId,
      updatedLeaveData
    );
  } catch (error) {
    console.error("Error updating employee leave:", error);
    throw error;
  }
};

// Update Employee
export const updateEmployeeRecord = async (
  employeeId: string,
  formData: Partial<Omit<EmployeeDoc, keyof Models.Document>>
): Promise<EmployeeDoc> => {
  try {
    const updatedEmployee = await databases.updateDocument<EmployeeDoc>(
      databaseId,
      employeesCollectionId,
      employeeId,
      formData
    );
    return updatedEmployee;
  } catch (error) {
    console.error("Error updating employee record:", error);
    throw new Error("Failed to update employee record.");
  }
};

// Delete all attendances for a specific date
export const deleteAttendancesByDate = async (date: string): Promise<void> => {
  try {
    const response = await databases.listDocuments<AttendanceDoc>(
      databaseId,
      attendanceCollectionId,
      [Query.equal("date", date)]
    );

    if (response.documents.length === 0) return;

    await Promise.all(
      response.documents.map((record) =>
        databases.deleteDocument(databaseId, attendanceCollectionId, record.$id)
      )
    );
  } catch (error) {
    console.error(`Error deleting attendance records for ${date}:`, error);
    throw new Error(`Failed to delete attendance records for ${date}`);
  }
};

/* =============================== Mosque Assistants =============================== */

// Fetch mosque attendance for a date
export const fetchMosqueAttendanceForDate = async (
  date: string
): Promise<MosqueAttendanceDoc[]> => {
  try {
    const response = await databases.listDocuments<MosqueAttendanceDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching mosque attendance:", error);
    throw error;
  }
};

// Create attendance rows for mosque assistants
export const createMosqueAttendanceForEmployees = async (
  date: string,
  employees: EmployeeDoc[]
): Promise<Array<Omit<MosqueAttendanceDoc, keyof Models.Document>>> => {
  try {
    const entries: Array<Omit<MosqueAttendanceDoc, keyof Models.Document>> =
      employees.map((employee) => ({
        employeeId: employee.$id, // your collection uses string id
        date,
        fathisSignInTime: null,
        mendhuruSignInTime: null,
        asuruSignInTime: null,
        maqribSignInTime: null,
        ishaSignInTime: null,
        leaveType: null,
        // minutesLate fields are usually computed later; omit here
      }));

    await Promise.all(
      entries.map((entry) =>
        databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.mosqueAttendanceCollectionId,
          ID.unique(),
          entry
        )
      )
    );

    return entries;
  } catch (error) {
    console.error("Error creating mosque attendance:", error);
    throw error;
  }
};

// Update mosque attendance record
export const updateMosqueAttendanceRecord = async (
  attendanceId: string,
  updates: Partial<MosqueAttendanceRecord>
): Promise<MosqueAttendanceDoc> => {
  try {
    const response = await databases.updateDocument<MosqueAttendanceDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      attendanceId,
      updates
    );
    return response;
  } catch (error) {
    console.error("Error updating mosque attendance record:", error);
    throw error;
  }
};

/* =============================== Prayer Times =============================== */

// Save prayer times
export const savePrayerTimes = async (
  prayerTimes: Omit<PrayerTimesDoc, keyof Models.Document>
): Promise<PrayerTimesDoc> => {
  try {
    const response = await databases.createDocument<PrayerTimesDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      ID.unique(),
      prayerTimes
    );
    return response;
  } catch (error) {
    console.error("Error saving prayer times:", error);
    throw error;
  }
};

// Update prayer times
export const updatePrayerTimes = async (
  recordId: string,
  updatedTimes: Partial<
    Pick<
      PrayerTimesDoc,
      "fathisTime" | "mendhuruTime" | "asuruTime" | "maqribTime" | "ishaTime"
    >
  >
): Promise<PrayerTimesDoc> => {
  try {
    const response = await databases.updateDocument<PrayerTimesDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      recordId,
      updatedTimes
    );
    return response;
  } catch (error) {
    console.error("Error updating prayer times:", error);
    throw error;
  }
};

// Get prayer times by date
export const fetchPrayerTimesByDate = async (
  date: string
): Promise<PrayerTimesDoc | null> => {
  try {
    const response = await databases.listDocuments<PrayerTimesDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents[0] || null;
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    throw error;
  }
};

// Get prayer times by month
export const fetchPrayerTimesForMonth = async (
  month: string
): Promise<PrayerTimesDoc[]> => {
  try {
    const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
    const endOfMonth = new Date(
      new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)
    ).toISOString();

    const response = await databases.listDocuments<PrayerTimesDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      [
        Query.greaterThanEqual("date", startOfMonth),
        Query.lessThanEqual("date", endOfMonth),
      ]
    );

    return response.documents;
  } catch (error) {
    console.error("Error fetching prayer times for the month:", error);
    throw error;
  }
};

/* =============================== Mosque Attendance – Month =============================== */

export const fetchMosqueAttendanceForMonth = async (
  month: string
): Promise<MosqueAttendanceDoc[]> => {
  const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
  const endOfMonth = new Date(
    new Date(`${month}-01T00:00:00Z`).setMonth(
      new Date(`${month}-01`).getMonth() + 1
    )
  ).toISOString();

  const results: MosqueAttendanceDoc[] = [];
  let hasMore = true;
  let offset = 0;
  const limit = 100;

  try {
    while (hasMore) {
      const response = await databases.listDocuments<MosqueAttendanceDoc>(
        appwriteConfig.databaseId,
        appwriteConfig.mosqueAttendanceCollectionId,
        [
          Query.greaterThanEqual("date", startOfMonth),
          Query.lessThanEqual("date", endOfMonth),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      results.push(...response.documents);
      hasMore = response.documents.length === limit;
      offset += hasMore ? limit : 0;
    }
    return results;
  } catch (error) {
    console.error("Error fetching attendance for the month:", error);
    throw error;
  }
};

// Get daily mosque attendance for a month (single employee)
export const fetchMosqueDailyAttendanceForMonth = async (
  month: string,
  employeeId: string
): Promise<MosqueAttendanceDoc[]> => {
  try {
    const startOfMonth = `${month}-01T00:00:00Z`;
    const endOfMonth = new Date(
      new Date(`${month}-01T00:00:00Z`).setMonth(
        new Date(`${month}-01T00:00:00Z`).getMonth() + 1
      )
    ).toISOString();

    const response = await databases.listDocuments<MosqueAttendanceDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      [
        Query.greaterThanEqual("date", startOfMonth),
        Query.lessThanEqual("date", endOfMonth),
        Query.equal("employeeId", employeeId),
      ]
    );

    return response.documents;
  } catch (error) {
    console.error("Error fetching mosque attendance:", error);
    throw error;
  }
};

// Get mosque assistants
export const fetchMosqueAssistants = async (): Promise<EmployeeDoc[]> => {
  try {
    const response = await databases.listDocuments<EmployeeDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.employeesCollectionId,
      [Query.equal("designation", "Mosque Assistant")]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching mosque assistants:", error);
    throw error;
  }
};

// Delete mosque attendances by date
export const deleteMosqueAttendancesByDate = async (
  date: string
): Promise<void> => {
  try {
    const response = await databases.listDocuments<MosqueAttendanceDoc>(
      databaseId,
      mosqueAttendanceCollectionId,
      [Query.equal("date", date)]
    );

    if (response.documents.length === 0) return;

    await Promise.all(
      response.documents.map((record) =>
        databases.deleteDocument(
          databaseId,
          mosqueAttendanceCollectionId,
          record.$id
        )
      )
    );
  } catch (error) {
    console.error(`Error deleting attendance records for ${date}:`, error);
    throw new Error(`Failed to delete attendance records for ${date}`);
  }
};

/* =============================== Auth =============================== */

export const createEmailSession = async (email: string, password: string) => {
  try {
    const response = await account.createEmailPasswordSession(email, password);
    return response;
  } catch (error) {
    console.error("Error creating email session:", error);
    throw error;
  }
};

/* =============================== Leave Requests =============================== */

// Create leave request
export const createLeaveRequest = async (leaveRequestData: {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
}): Promise<LeaveRequest> => {
  try {
    const currentDateTime = new Date().toISOString();

    const response = await databases.createDocument<LeaveRequest>(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      ID.unique(),
      {
        ...leaveRequestData,
        createdAt: currentDateTime,
        approvalStatus: "Pending",
      }
    );

    return response;
  } catch (error) {
    console.error("Error creating leave request:", error);
    throw new Error("Failed to create leave request.");
  }
};

// Get leave requests for admin
export const fetchLeaveRequests = async (
  limit = 10,
  offsetVal = 0
): Promise<{ requests: LeaveRequest[]; totalCount: number }> => {
  try {
    const response = await databases.listDocuments<LeaveRequest>(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      [
        Query.orderDesc("createdAt"),
        Query.limit(limit),
        Query.offset(offsetVal),
      ]
    );

    return {
      requests: response.documents,
      totalCount: response.total,
    };
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    throw error;
  }
};

// Update leave request
export const updateLeaveRequest = async (
  requestId: string,
  data: { approvalStatus: string; actionBy?: string }
): Promise<void> => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      requestId,
      data
    );
  } catch (error) {
    console.error("Error updating leave request:", error);
    throw error;
  }
};

// Get leave requests for a user (optionally filtered by status)
export const fetchUserLeaveRequests = async (
  status?: string,
  limit = 10,
  offsetVal = 0
): Promise<{ requests: LeaveRequest[]; totalCount: number }> => {
  try {
    const filters = status ? [Query.equal("approvalStatus", status)] : [];

    const response = await databases.listDocuments<LeaveRequest>(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      [
        ...filters,
        Query.limit(limit),
        Query.offset(offsetVal),
        Query.orderDesc("createdAt"),
      ]
    );

    return {
      requests: response.documents,
      totalCount: response.total,
    };
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    throw error;
  }
};
