// seed-inn-council.ts (fixed)
// Idempotently ensures DB & collections. Defaults only when required === false.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Client, Databases } from "node-appwrite";

/* ---------- IDs ---------- */
const ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "66f134a7001102e81a6d";
const API_KEY = process.env.NEXT_APPWRITE_KEY || ""; // REQUIRED

const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE || "66f135a0002dfd91853a";

const EMPLOYEES_ID =
  process.env.NEXT_PUBLIC_APPWRITE_EMPLOYEES_COLLECTION ||
  "6708bd860020db2f8598";
const ATTENDANCE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_ATTENDANCE_COLLECTION ||
  "6701373d00373ea0dd09";
const MOSQUE_ATTENDANCE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_MOSQUE_ATTENDANCE_COLLECTION ||
  "6748841b0005589c9c31";
const PRAYER_TIMES_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PRAYER_TIMES_COLLECTION ||
  "6749573400305f49417b";
const LEAVE_REQUESTS_ID =
  process.env.NEXT_PUBLIC_APPWRITE_LEAVE_REQUESTS_COLLECTION ||
  "674ee238003517f3004d";
const WASTE_MGMT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_WASTE_MANAGEMENT_COLLECTION ||
  "6784e0610000e598d1e6";

/* ---------- SDK ---------- */
function getSDK() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY || !DATABASE_ID) {
    throw new Error(
      "Missing one of: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, NEXT_APPWRITE_KEY, NEXT_PUBLIC_APPWRITE_DATABASE"
    );
  }
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
  return { databases: new Databases(client) };
}

/* ---------- helpers ---------- */
async function ensureDatabase(
  databases: Databases,
  databaseId: string,
  name = "Main"
) {
  try {
    await databases.get(databaseId);
  } catch {
    await databases.create(databaseId, name);
  }
}

async function ensureCollection(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  name: string
) {
  try {
    await databases.getCollection(databaseId, collectionId);
  } catch {
    await databases.createCollection(databaseId, collectionId, name, [], true);
  }
}

async function ensureStringAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  size: number,
  required: boolean,
  array = false,
  defaultVal?: string
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
  } catch {
    // Only pass default if not required
    await databases.createStringAttribute(
      databaseId,
      collectionId,
      key,
      size,
      required,
      required ? undefined : defaultVal,
      array
    );
  }
}

async function ensureIntegerAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  required: boolean,
  min?: number,
  max?: number,
  array = false,
  defaultVal?: number
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
  } catch {
    await databases.createIntegerAttribute(
      databaseId,
      collectionId,
      key,
      required,
      min,
      max,
      required ? undefined : defaultVal,
      array
    );
  }
}

async function ensureBooleanAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  required: boolean,
  defaultVal?: boolean
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
  } catch {
    await databases.createBooleanAttribute(
      databaseId,
      collectionId,
      key,
      required,
      required ? undefined : defaultVal
    );
  }
}

async function ensureDatetimeAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  required: boolean
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
  } catch {
    await databases.createDatetimeAttribute(
      databaseId,
      collectionId,
      key,
      required
    );
  }
}

async function ensureIndex(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  type: "key" | "unique" | "fulltext",
  attributes: string[],
  orders?: ("asc" | "desc")[]
) {
  try {
    await databases.getIndex(databaseId, collectionId, key);
  } catch {
    await databases.createIndex(
      databaseId,
      collectionId,
      key,
      type as any,
      attributes,
      orders ?? attributes.map(() => "asc")
    );
  }
}

/* ---------- schemas ---------- */
async function ensureEmployees(databases: Databases) {
  await ensureCollection(databases, DATABASE_ID, EMPLOYEES_ID, "Employees");
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "fullName",
    128,
    false
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "designation",
    64,
    false
  );
  await ensureIntegerAttribute(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "annualLeave",
    false,
    0,
    365,
    false,
    0
  );
  await ensureIntegerAttribute(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "sickLeave",
    false,
    0,
    365,
    false,
    0
  );
  await ensureIntegerAttribute(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "casualLeave",
    false,
    0,
    365,
    false,
    0
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "idx_designation",
    "key",
    ["designation"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    EMPLOYEES_ID,
    "idx_fullName",
    "fulltext",
    ["fullName"]
  );
}

async function ensureAttendance(databases: Databases) {
  await ensureCollection(databases, DATABASE_ID, ATTENDANCE_ID, "Attendance");
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "employeeId",
    64,
    true
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "date",
    true
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "signInTime",
    false
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "leaveType",
    32,
    false
  );
  await ensureIntegerAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "minutesLate",
    false,
    0,
    10000,
    false,
    0
  );
  await ensureBooleanAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "leaveDeducted",
    false,
    false
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "previousLeaveType",
    32,
    false
  );

  await ensureIndex(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "idx_att_date",
    "key",
    ["date"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    ATTENDANCE_ID,
    "idx_att_emp",
    "key",
    ["employeeId"]
  );
}

async function ensureMosqueAttendance(databases: Databases) {
  await ensureCollection(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "MosqueAttendance"
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "employeeId",
    64,
    true
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "date",
    true
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "fathisSignInTime",
    false
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "mendhuruSignInTime",
    false
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "asuruSignInTime",
    false
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "maqribSignInTime",
    false
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "ishaSignInTime",
    false
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "leaveType",
    32,
    false
  );

  await ensureIndex(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "idx_mosque_date",
    "key",
    ["date"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    MOSQUE_ATTENDANCE_ID,
    "idx_mosque_emp",
    "key",
    ["employeeId"]
  );
}

async function ensurePrayerTimes(databases: Databases) {
  await ensureCollection(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "PrayerTimes"
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "date",
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "fathisTime",
    16,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "mendhuruTime",
    16,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "asuruTime",
    16,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "maqribTime",
    16,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "ishaTime",
    16,
    true
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    PRAYER_TIMES_ID,
    "idx_prayer_date_unique",
    "unique",
    ["date"]
  );
}

async function ensureLeaveRequests(databases: Databases) {
  await ensureCollection(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "LeaveRequests"
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "fullName",
    128,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "leaveType",
    64,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "reason",
    2048,
    true
  );
  await ensureIntegerAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "totalDays",
    true,
    0,
    365
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "startDate",
    true
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "endDate",
    true
  );
  // Not required, but default "Pending"
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "approvalStatus",
    32,
    false,
    false,
    "Pending"
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "createdAt",
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "actionBy",
    128,
    false
  );

  await ensureIndex(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "idx_leave_created_desc",
    "key",
    ["createdAt"],
    ["desc"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    LEAVE_REQUESTS_ID,
    "idx_leave_status",
    "key",
    ["approvalStatus"]
  );
}

async function ensureWasteManagement(databases: Databases) {
  await ensureCollection(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "WasteManagementForms"
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "nationalId",
    32,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "status",
    32,
    false
  );
  await ensureDatetimeAttribute(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "createdAt",
    true
  );

  await ensureIndex(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "idx_waste_nationalId",
    "key",
    ["nationalId"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    WASTE_MGMT_ID,
    "idx_waste_created_desc",
    "key",
    ["createdAt"],
    ["desc"]
  );
}

/* ---------- main ---------- */
async function main() {
  const { databases } = getSDK();

  console.log("> Ensuring database…");
  await ensureDatabase(databases, DATABASE_ID);

  console.log("> Ensuring Employees…");
  await ensureEmployees(databases);

  console.log("> Ensuring Attendance…");
  await ensureAttendance(databases);

  console.log("> Ensuring Mosque Attendance…");
  await ensureMosqueAttendance(databases);

  console.log("> Ensuring Prayer Times…");
  await ensurePrayerTimes(databases);

  console.log("> Ensuring Leave Requests…");
  await ensureLeaveRequests(databases);

  console.log("> Ensuring Waste Management Forms…");
  await ensureWasteManagement(databases);

  console.log("\n✅ All collections ensured.");
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
