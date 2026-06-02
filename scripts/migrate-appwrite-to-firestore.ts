/**
 * One-time migration: export all Appwrite collections to Firestore (council-hr-dashboard).
 * Preserves Appwrite $id as Firestore document IDs.
 *
 * Usage: npm run migrate:firestore
 * Requires Appwrite env vars + Firebase Admin env vars in .env.local
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
config();

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { Client, Databases, Query, Storage } from "node-appwrite";
import { writeFileSync } from "fs";

type MigrationTarget = {
  name: string;
  firestoreCollection: string;
  appwrite: {
    endpoint: string;
    projectId: string;
    apiKey: string;
    databaseId: string;
    collectionId: string;
  };
};

function initFirebase(): Firestore {
  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID ?? "council-hr-dashboard";
  return getFirestore(getApps()[0]!, dbId);
}

function appwriteDb(endpoint: string, projectId: string, apiKey: string) {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Databases(client);
}

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function stripAppwriteMeta(doc: Record<string, unknown>) {
  const {
    $id,
    $createdAt,
    $updatedAt,
    $collectionId,
    $databaseId,
    $permissions,
    $sequence,
    ...rest
  } = doc;
  void $collectionId;
  void $databaseId;
  void $permissions;
  void $sequence;
  return {
    id: String($id),
    data: {
      ...rest,
      ...( $createdAt ? { createdAt: $createdAt } : {}),
      ...( $updatedAt ? { updatedAt: $updatedAt } : {}),
    },
  };
}

async function exportCollection(
  db: Databases,
  databaseId: string,
  collectionId: string,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const page = await db.listDocuments(databaseId, collectionId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);
    results.push(...(page.documents as Record<string, unknown>[]));
    if (page.documents.length < limit) break;
    offset += limit;
  }
  return results;
}

async function importToFirestore(
  firestore: Firestore,
  collection: string,
  docs: Record<string, unknown>[],
) {
  let written = 0;
  for (const raw of docs) {
    const { id, data } = stripAppwriteMeta(raw);
    await firestore.collection(collection).doc(id).set(data, { merge: true });
    written += 1;
  }
  return written;
}

function buildTargets(): MigrationTarget[] {
  const hrEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const hrProject = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "68fafb190023ef05bc17";
  const hrDb = process.env.NEXT_PUBLIC_APPWRITE_DATABASE ?? "68fafc1000231aecbf69";
  const hrKey = must("NEXT_APPWRITE_KEY");

  const hr = (name: string, firestoreCollection: string, collectionId: string) => ({
    name,
    firestoreCollection,
    appwrite: {
      endpoint: hrEndpoint,
      projectId: hrProject,
      apiKey: hrKey,
      databaseId: hrDb,
      collectionId,
    },
  });

  const targets: MigrationTarget[] = [
    hr("employees", "employees", "6708bd860020db2f8598"),
    hr("attendance", "attendance", "6701373d00373ea0dd09"),
    hr("mosque_attendance", "mosque_attendance", "6748841b0005589c9c31"),
    hr("prayer_times", "prayer_times", "6749573400305f49417b"),
    hr("leave_requests", "leave_requests", "674ee238003517f3004d"),
    hr("waste_management_forms", "waste_management_forms", "6784e0610000e598d1e6"),
  ];

  const pushEnv = (name: string, firestoreCollection: string, envName: string, fallback?: string) => {
    const collectionId = process.env[envName] ?? fallback;
    if (!collectionId) return;
    targets.push(hr(name, firestoreCollection, collectionId));
  };

  pushEnv("punch_logs", "punch_logs", "NEXT_PUBLIC_APPWRITE_PUNCH_LOGS_RAW_COLLECTION");
  pushEnv("punch_logs", "punch_logs", "NEXT_PUBLIC_APPWRITE_PUNCHLOGS_COLLECTION");
  pushEnv("salary_slips", "salary_slips", "NEXT_PUBLIC_APPWRITE_SALARY_SLIPS_COLLECTION_ID");
  pushEnv("correspondence", "correspondence", "NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION");
  pushEnv("land_parcels", "land_parcels", "NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  pushEnv("land_tenants", "land_tenants", "NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");
  pushEnv("land_leases", "land_leases", "NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  pushEnv("land_payments", "land_payments", "NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");
  pushEnv("land_statements", "land_statements", "NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  const billingEndpoint = process.env.APPWRITE_BILLING_ENDPOINT;
  const billingProject = process.env.APPWRITE_BILLING_PROJECT_ID;
  const billingDb = process.env.APPWRITE_BILLING_DB_ID;
  const billingKey = process.env.APPWRITE_BILLING_API_KEY;
  if (billingEndpoint && billingProject && billingDb && billingKey) {
    const billing = (name: string, firestoreCollection: string, envName: string) => {
      const collectionId = process.env[envName];
      if (!collectionId) return;
      targets.push({
        name,
        firestoreCollection,
        appwrite: {
          endpoint: billingEndpoint,
          projectId: billingProject,
          apiKey: billingKey,
          databaseId: billingDb,
          collectionId,
        },
      });
    };
    billing("waste_subscriptions", "waste_subscriptions", "APPWRITE_BILLING_COL_WASTE_SUBSCRIPTIONS");
    billing("invoices", "invoices", "APPWRITE_BILLING_COL_INVOICES");
    billing("invoice_items", "invoice_items", "APPWRITE_BILLING_COL_INVOICE_ITEMS");
    billing("payments", "payments", "APPWRITE_BILLING_COL_PAYMENTS");
    billing("payment_allocations", "payment_allocations", "APPWRITE_BILLING_COL_PAYMENT_ALLOCATIONS");
    billing("counters", "counters", "APPWRITE_BILLING_COL_COUNTERS");
    billing("audit_logs", "audit_logs", "APPWRITE_BILLING_COL_AUDIT_LOGS");
  }

  const customersEndpoint = process.env.APPWRITE_CUSTOMERS_ENDPOINT;
  const customersProject = process.env.APPWRITE_CUSTOMERS_PROJECT_ID;
  const customersDb = process.env.APPWRITE_CUSTOMERS_DB_ID;
  const customersKey = process.env.APPWRITE_CUSTOMERS_API_KEY;
  if (customersEndpoint && customersProject && customersDb && customersKey) {
    const col = process.env.APPWRITE_CUSTOMERS_COL_WASTE_CUSTOMERS;
    if (col) {
      targets.push({
        name: "waste_customers",
        firestoreCollection: "waste_customers",
        appwrite: {
          endpoint: customersEndpoint,
          projectId: customersProject,
          apiKey: customersKey,
          databaseId: customersDb,
          collectionId: col,
        },
      });
    }
  }

  return targets;
}

async function main() {
  const firestore = initFirebase();
  const targets = buildTargets();
  const report: Record<string, { exported: number; imported: number }> = {};

  for (const target of targets) {
    if (!target.appwrite.collectionId) continue;
    console.log(`Migrating ${target.name}...`);
    const db = appwriteDb(
      target.appwrite.endpoint,
      target.appwrite.projectId,
      target.appwrite.apiKey,
    );
    let docs: Record<string, unknown>[];
    try {
      docs = await exportCollection(
        db,
        target.appwrite.databaseId,
        target.appwrite.collectionId,
      );
    } catch (e: unknown) {
      const err = e as { code?: number; type?: string; message?: string };
      if (
        err.code === 404 ||
        err.type === "collection_not_found" ||
        err.type === "project_paused" ||
        err.code === 401 ||
        err.code === 403
      ) {
        console.warn(`  Skipped: ${err.message ?? err.type ?? e}`);
        report[target.name] = { exported: 0, imported: 0 };
        continue;
      }
      throw e;
    }
    const imported = await importToFirestore(
      firestore,
      target.firestoreCollection,
      docs,
    );
    report[target.name] = { exported: docs.length, imported };
    console.log(`  ${imported}/${docs.length} documents`);
  }

  writeFileSync("migration-report.json", JSON.stringify(report, null, 2));
  console.log("Done. See migration-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
