// seed-appwrite.ts
// Idempotent seeder: ensures DB, "users" collection, attributes & indexes.
// Keeps typing minimal to avoid SDK version differences.

import * as dotenv from "dotenv";
import { Client, Databases } from "node-appwrite";
dotenv.config({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.NEXT_APPWRITE_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE!; // e.g. 68fafc1000231aecbf69
const USERS_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION || "users";

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
    // createCollection(databaseId, collectionId, name, permissions?, documentSecurity?)
    await databases.createCollection(databaseId, collectionId, name, [], true);
  }
}

async function ensureStringAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  size: number,
  required: boolean
) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    // Exists -> nothing to do
  } catch {
    await databases.createStringAttribute(
      databaseId,
      collectionId,
      key,
      size,
      required
    );
  }
}

async function ensureIndex(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
  type: "key" | "unique",
  attributes: string[]
) {
  try {
    await databases.getIndex(databaseId, collectionId, key);
    // Exists
  } catch {
    // Orders must match attributes count
    const orders = attributes.map(() => "asc");
    // Some SDKs type 'type' as a string union, others as IndexType enum; cast keeps TS happy.
    await databases.createIndex(
      databaseId,
      collectionId,
      key,
      type as any,
      attributes,
      orders
    );
  }
}

async function main() {
  const { databases } = getSDK();

  console.log("> Ensuring database…");
  await ensureDatabase(databases, DATABASE_ID);

  console.log(`> Ensuring collection: ${USERS_COLLECTION_ID}`);
  await ensureCollection(databases, DATABASE_ID, USERS_COLLECTION_ID!, "Users");

  console.log("> Ensuring attributes…");
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "fullName",
    128,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "email",
    320,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "accountId",
    64,
    true
  );
  await ensureStringAttribute(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "avatar",
    2048,
    false
  );

  console.log("> Ensuring indexes…");
  await ensureIndex(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "idx_email_unique",
    "unique",
    ["email"]
  );
  await ensureIndex(
    databases,
    DATABASE_ID,
    USERS_COLLECTION_ID!,
    "idx_accountId",
    "key",
    ["accountId"]
  );

  console.log("\n✅ Seed complete.");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project : ${PROJECT_ID}`);
  console.log(`DB      : ${DATABASE_ID}`);
  console.log(`Coll    : ${USERS_COLLECTION_ID}\n`);
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
