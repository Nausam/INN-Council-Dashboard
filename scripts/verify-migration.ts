/**
 * Post-migration verification: Firestore counts, Clerk users, env, R2, Appwrite gaps.
 * Usage: npx tsx scripts/verify-migration.ts
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
config();

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createClerkClient } from "@clerk/backend";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Client, Databases, Users } from "node-appwrite";

type Check = { name: string; status: "pass" | "warn" | "fail"; detail: string };

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, status: "pass", detail });
}
function warn(name: string, detail: string) {
  checks.push({ name, status: "warn", detail });
}
function fail(name: string, detail: string) {
  checks.push({ name, status: "fail", detail });
}

function initFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    });
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID ?? "council-hr-dashboard";
  return getFirestore(getApps()[0]!, dbId);
}

async function countCollection(db: FirebaseFirestore.Firestore, name: string) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function verifyFirestore() {
  const reportPath = resolve(root, "migration-report.json");
  if (!existsSync(reportPath)) {
    fail("Firestore report", "migration-report.json not found");
    return;
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<
    string,
    { exported: number; imported: number }
  >;

  const db = initFirebase();
  let mismatches = 0;

  for (const [key, expected] of Object.entries(report)) {
    const actual = await countCollection(db, key);
    if (actual !== expected.imported) {
      mismatches += 1;
      fail(
        `Firestore:${key}`,
        `expected ${expected.imported}, found ${actual} in ${key}`,
      );
    } else if (expected.imported > 0) {
      pass(`Firestore:${key}`, `${actual} documents`);
    } else {
      pass(`Firestore:${key}`, "empty (expected)");
    }
  }
  if (mismatches === 0) {
    pass("Firestore totals", "All collection counts match migration-report.json");
  }
}

async function verifyClerk() {
  const mapPath = resolve(root, "user-migration-map.json");
  if (!existsSync(mapPath)) {
    fail("Clerk map", "user-migration-map.json not found");
    return;
  }
  const mapping = JSON.parse(readFileSync(mapPath, "utf8")) as Array<{
    clerkUserId: string;
    email: string;
  }>;

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  for (const row of mapping) {
    try {
      const user = await clerk.users.getUser(row.clerkUserId);
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (email?.toLowerCase() !== row.email.toLowerCase()) {
        warn("Clerk user", `${row.email}: id ok but email mismatch (${email})`);
      } else {
        pass("Clerk user", `${row.email} → ${row.clerkUserId}`);
      }
    } catch {
      fail("Clerk user", `${row.email}: ${row.clerkUserId} not found in Clerk`);
    }
  }
}

async function verifyEnv() {
  const required = [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIRESTORE_DATABASE_ID",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    fail("Env required", `Missing: ${missing.join(", ")}`);
  } else {
    pass("Env required", "Firebase, Clerk, and R2 salary-slip vars set");
  }

  if (!process.env.R2_CORRESPONDENCE_BUCKET_NAME?.trim()) {
    warn(
      "Env optional",
      "R2_CORRESPONDENCE_BUCKET_NAME empty — document receiver attachments disabled",
    );
  } else {
    pass("Env optional", "R2_CORRESPONDENCE_BUCKET_NAME set");
  }
}

async function verifyR2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    fail("R2", "Credentials incomplete");
    return;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    pass("R2 bucket", `${R2_BUCKET_NAME} reachable`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("R2 bucket", `${R2_BUCKET_NAME}: ${msg}`);
  }
}

async function verifyAppwriteGaps() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
  const apiKey = process.env.NEXT_APPWRITE_KEY!;
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const usersApi = new Users(client);
  const databases = new Databases(client);

  try {
    const users = await usersApi.list();
    pass("Appwrite HR users", `${users.total} accounts (Clerk should match)`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Appwrite HR", msg);
  }

  const corrId =
    process.env.NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION ?? "council_correspondence";
  try {
    await databases.getCollection(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE!,
      corrId,
    );
    warn("Appwrite correspondence", `Collection ${corrId} exists but was not migrated`);
  } catch {
    pass("Appwrite correspondence", "No collection in Appwrite (nothing to migrate)");
  }

  const councilEndpoint = process.env.NEXT_PUBLIC_APP_APPWRITE_ENDPOINT;
  const councilProject = process.env.NEXT_PUBLIC_APP_APPWRITE_PROJECT_ID;
  if (councilEndpoint && councilProject) {
    const councilClient = new Client()
      .setEndpoint(councilEndpoint)
      .setProject(councilProject)
      .setKey(apiKey);
    const councilDb = new Databases(councilClient);
    try {
      await councilDb.list();
      warn("Appwrite council", "Project reachable — re-run migrate:firestore if not done");
    } catch (e: unknown) {
      const err = e as { type?: string; message?: string };
      warn(
        "Appwrite council",
        err.type === "project_paused"
          ? "Project still paused — council data not migrated"
          : (err.message ?? String(e)),
      );
    }
  }

  const customersProject = process.env.APPWRITE_CUSTOMERS_PROJECT_ID;
  const customersKey = process.env.APPWRITE_CUSTOMERS_API_KEY;
  if (customersProject && customersKey) {
    const customersClient = new Client()
      .setEndpoint(process.env.APPWRITE_CUSTOMERS_ENDPOINT!)
      .setProject(customersProject)
      .setKey(customersKey);
    const customersDb = new Databases(customersClient);
    try {
      await customersDb.list();
      warn("Appwrite customers", "Project reachable — waste_customers may need re-migration");
    } catch (e: unknown) {
      const err = e as { type?: string; message?: string };
      warn(
        "Appwrite customers",
        err.type === "project_paused"
          ? "Project still paused — waste_customers not migrated"
          : (err.message ?? String(e)),
      );
    }
  }
}

async function main() {
  console.log("=== Migration verification ===\n");
  await verifyEnv();
  await verifyFirestore();
  await verifyClerk();
  await verifyR2();
  await verifyAppwriteGaps();

  const passed = checks.filter((c) => c.status === "pass").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  console.log("\n--- Results ---");
  for (const c of checks) {
    const icon = c.status === "pass" ? "OK" : c.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${c.name}: ${c.detail}`);
  }
  console.log(`\nSummary: ${passed} pass, ${warnings} warn, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
