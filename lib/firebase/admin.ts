import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type FirebaseAdminCache = {
  app?: App;
  dbByDatabaseId: Record<string, Firestore>;
};

const firebaseAdminCache = globalThis as typeof globalThis & {
  __hrDashboardFirebaseAdmin?: FirebaseAdminCache;
};

function getCache(): FirebaseAdminCache {
  firebaseAdminCache.__hrDashboardFirebaseAdmin ??= {
    dbByDatabaseId: {},
  };
  return firebaseAdminCache.__hrDashboardFirebaseAdmin;
}

function getFirebaseApp(): App {
  const cache = getCache();
  if (cache.app) return cache.app;

  const existing = getApps();
  if (existing.length > 0) {
    cache.app = existing[0]!;
    return cache.app;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  cache.app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });

  return cache.app;
}

export function getFirestoreDb(): Firestore {
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ?? "council-hr-dashboard";
  const cache = getCache();
  const cachedDb = cache.dbByDatabaseId[databaseId];
  if (cachedDb) return cachedDb;

  const db = getFirestore(getFirebaseApp(), databaseId);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("settings()")) {
      throw error;
    }
  }
  cache.dbByDatabaseId[databaseId] = db;
  return db;
}

/** Firestore collection names in council-hr-dashboard */
export const COLLECTIONS = {
  employees: "employees",
  salarySlips: "salary_slips",
  salaryPeriodConfig: "salary_period_config",
  holidayCalendar: "holiday_calendar",
  attendance: "attendance",
  mosqueAttendance: "mosque_attendance",
  prayerTimes: "prayer_times",
  leaveRequests: "leave_requests",
  overtimeRequests: "overtime_requests",
  punchLogs: "punch_logs",
  integrationStatus: "integration_status",
  correspondence: "correspondence",
  landParcels: "land_parcels",
  landTenants: "land_tenants",
  landLeases: "land_leases",
  landStatements: "land_statements",
  landPayments: "land_payments",
  posts: "posts",
  publications: "publications",
  wasteCustomers: "waste_customers",
  wasteSubscriptions: "waste_subscriptions",
  invoices: "invoices",
  invoiceItems: "invoice_items",
  payments: "payments",
  paymentAllocations: "payment_allocations",
  counters: "counters",
  auditLogs: "audit_logs",
  wasteManagementForms: "waste_management_forms",
} as const;
