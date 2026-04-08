/**
 * Creates the Appwrite collection for the document receiver registry.
 *
 * Prerequisites (in .env.local or environment):
 *   NEXT_PUBLIC_APPWRITE_ENDPOINT
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID
 *   NEXT_PUBLIC_APPWRITE_DATABASE
 *   NEXT_APPWRITE_KEY  (API key with databases.write)
 *
 * Optional:
 *   CORRESPONDENCE_COLLECTION_ID — collection $id to create (default: council_correspondence)
 *
 * Usage:
 *   npx tsx scripts/create-correspondence-collection.ts
 *   npx tsx scripts/create-correspondence-collection.ts --recreate   # deletes existing collection first (destructive)
 *
 * After success, set in .env.local:
 *   NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION=<collection_id>
 *
 * Schema stays within Appwrite per-collection string attribute size limits (merge long
 * text into one `notes` field). Attachments use Cloudflare R2; `storageFileId` stores the object key (e.g. `document-receiver/...`).
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { Client, Databases, IndexType } from "node-appwrite";

import {
  CORRESPONDENCE_CHANNELS,
  CORRESPONDENCE_STATUSES,
} from "../types/correspondence";

const root = resolve(process.cwd());
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
config();

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE;
const apiKey = process.env.NEXT_APPWRITE_KEY;

const collectionId =
  process.env.CORRESPONDENCE_COLLECTION_ID?.trim() ||
  "council_correspondence";

const recreate = process.argv.includes("--recreate");

function requireEnv(): void {
  const missing: string[] = [];
  if (!endpoint) missing.push("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!projectId) missing.push("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  if (!databaseId) missing.push("NEXT_PUBLIC_APPWRITE_DATABASE");
  if (!apiKey) missing.push("NEXT_APPWRITE_KEY");
  if (missing.length) {
    console.error("Missing env:", missing.join(", "));
    process.exit(1);
  }
}

type AttrStatus = { status?: string; key?: string };

async function waitForAttribute(
  databases: Databases,
  db: string,
  coll: string,
  key: string,
): Promise<void> {
  const maxAttempts = 200;
  for (let i = 0; i < maxAttempts; i += 1) {
    const attr = (await databases.getAttribute(
      db,
      coll,
      key,
    )) as AttrStatus;
    const st = attr.status;
    if (st === "available") return;
    if (st === "failed") {
      throw new Error(`Attribute "${key}" failed to build in Appwrite`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for attribute "${key}" to become available`);
}

async function waitForIndex(
  databases: Databases,
  db: string,
  coll: string,
  indexKey: string,
): Promise<void> {
  const maxAttempts = 200;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const idx = (await databases.getIndex(db, coll, indexKey)) as {
        status?: string;
      };
      const st = idx.status;
      if (st === "available") return;
      if (st === "failed") {
        throw new Error(`Index "${indexKey}" failed to build`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        /* still provisioning */
      } else {
        throw e;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for index "${indexKey}"`);
}

async function main(): Promise<void> {
  requireEnv();

  const client = new Client()
    .setEndpoint(endpoint!)
    .setProject(projectId!)
    .setKey(apiKey!);

  const databases = new Databases(client);

  if (recreate) {
    try {
      await databases.deleteCollection(databaseId!, collectionId);
      console.log(`Removed existing collection "${collectionId}".`);
    } catch {
      /* ignore */
    }
  } else {
    try {
      await databases.getCollection(databaseId!, collectionId);
      console.log(
        `Collection "${collectionId}" already exists. Use --recreate to delete and recreate (destructive).`,
      );
      console.log(
        `\nSet NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION=${collectionId}`,
      );
      return;
    } catch {
      /* create below */
    }
  }

  console.log(`Creating collection "${collectionId}"…`);

  await databases.createCollection(
    databaseId!,
    collectionId,
    "Document receiver",
    [],
    false,
    true,
  );

  const db = databaseId!;
  const coll = collectionId;

  // --- Attributes (order: create → wait before next) ---
  await databases.createStringAttribute(db, coll, "referenceNumber", 64, true);
  await waitForAttribute(databases, db, coll, "referenceNumber");

  // Required enums: no default (Appwrite 1.9+ rejects defaults on required attributes).
  await databases.createEnumAttribute(
    db,
    coll,
    "channel",
    [...CORRESPONDENCE_CHANNELS],
    true,
  );
  await waitForAttribute(databases, db, coll, "channel");

  await databases.createStringAttribute(db, coll, "subject", 384, true);
  await waitForAttribute(databases, db, coll, "subject");

  await databases.createStringAttribute(db, coll, "senderName", 128, true);
  await waitForAttribute(databases, db, coll, "senderName");

  await databases.createStringAttribute(db, coll, "senderOrganization", 256, false);
  await waitForAttribute(databases, db, coll, "senderOrganization");

  await databases.createDatetimeAttribute(db, coll, "receivedAt", true);
  await waitForAttribute(databases, db, coll, "receivedAt");

  await databases.createDatetimeAttribute(db, coll, "dueAt", false);
  await waitForAttribute(databases, db, coll, "dueAt");

  await databases.createEnumAttribute(
    db,
    coll,
    "status",
    [...CORRESPONDENCE_STATUSES],
    true,
  );
  await waitForAttribute(databases, db, coll, "status");

  await databases.createDatetimeAttribute(db, coll, "answeredAt", false);
  await waitForAttribute(databases, db, coll, "answeredAt");

  await databases.createStringAttribute(db, coll, "notes", 4096, false);
  await waitForAttribute(databases, db, coll, "notes");

  await databases.createStringAttribute(db, coll, "assignedToUserId", 36, false);
  await waitForAttribute(databases, db, coll, "assignedToUserId");

  await databases.createStringAttribute(db, coll, "storageFileId", 768, false);
  await waitForAttribute(databases, db, coll, "storageFileId");

  await databases.createStringAttribute(db, coll, "fileName", 255, false);
  await waitForAttribute(databases, db, coll, "fileName");

  await databases.createIntegerAttribute(
    db,
    coll,
    "fileSize",
    false,
    0,
    1073741824,
  );
  await waitForAttribute(databases, db, coll, "fileSize");

  await databases.createStringAttribute(db, coll, "createdByUserId", 36, true);
  await waitForAttribute(databases, db, coll, "createdByUserId");

  await databases.createDatetimeAttribute(db, coll, "updatedAt", true);
  await waitForAttribute(databases, db, coll, "updatedAt");

  // --- Indexes ---
  console.log("Creating indexes…");

  await databases.createIndex(
    db,
    coll,
    "idx_received_at",
    IndexType.Key,
    ["receivedAt"],
    ["desc"],
  );
  await waitForIndex(databases, db, coll, "idx_received_at");

  await databases.createIndex(db, coll, "idx_status", IndexType.Key, ["status"]);
  await waitForIndex(databases, db, coll, "idx_status");

  await databases.createIndex(db, coll, "idx_due_at", IndexType.Key, ["dueAt"]);
  await waitForIndex(databases, db, coll, "idx_due_at");

  await databases.createIndex(
    db,
    coll,
    "idx_subject_search",
    IndexType.Fulltext,
    ["subject"],
  );
  await waitForIndex(databases, db, coll, "idx_subject_search");

  console.log("\nDone.");
  console.log(`Add to .env.local:\n`);
  console.log(
    `NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION=${collectionId}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
