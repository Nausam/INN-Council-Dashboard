/**
 * Import Appwrite auth users into Clerk.
 * Maps admin label -> privateMetadata.role = "admin"
 *
 * Usage: npm run migrate:clerk
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
config();

import { createClerkClient } from "@clerk/backend";
import { Client, Databases, Query, Users } from "node-appwrite";
import { writeFileSync } from "fs";

async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
  const apiKey = process.env.NEXT_APPWRITE_KEY!;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE!;
  const usersCollectionId = process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION!;

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const usersApi = new Users(client);
  const databases = new Databases(client);

  const appwriteUsers = await usersApi.list();
  const mapping: Array<{
    appwriteAccountId: string;
    clerkUserId: string;
    email: string;
    status: "created" | "existing";
  }> = [];

  async function findClerkUserByEmail(email: string) {
    const found = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    return found.data[0];
  }

  for (const au of appwriteUsers.users) {
    const email = au.email;
    if (!email) continue;

    const profiles = await databases.listDocuments(databaseId, usersCollectionId, [
      Query.equal("accountId", au.$id),
      Query.limit(1),
    ]);
    const profile = profiles.documents[0] as { fullName?: string } | undefined;
    const fullName = profile?.fullName ?? au.name ?? email;
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || undefined;
    const isAdmin = (au.labels ?? []).includes("admin");

    let clerkUser = await findClerkUserByEmail(email);
    let status: "created" | "existing" = "existing";

    if (!clerkUser) {
      try {
        clerkUser = await clerk.users.createUser({
          emailAddress: [email],
          firstName,
          lastName,
          skipPasswordRequirement: true,
          privateMetadata: isAdmin ? { role: "admin" } : {},
        });
        status = "created";
      } catch (e: unknown) {
        const err = e as { errors?: Array<{ code?: string }> };
        if (err.errors?.some((x) => x.code === "form_identifier_exists")) {
          clerkUser = await findClerkUserByEmail(email);
        }
        if (!clerkUser) throw e;
      }
    }

    if (isAdmin && clerkUser.privateMetadata?.role !== "admin") {
      await clerk.users.updateUser(clerkUser.id, {
        privateMetadata: { ...clerkUser.privateMetadata, role: "admin" },
      });
    }

    mapping.push({
      appwriteAccountId: au.$id,
      clerkUserId: clerkUser.id,
      email,
      status,
    });

    console.log(
      `${status === "created" ? "Created" : "Linked existing"} Clerk user ${email}${isAdmin ? " (admin)" : ""}`,
    );
  }

  writeFileSync("user-migration-map.json", JSON.stringify(mapping, null, 2));
  const created = mapping.filter((m) => m.status === "created").length;
  console.log(`Processed ${mapping.length} users (${created} created). See user-migration-map.json`);
  console.log("Send password reset emails from Clerk Dashboard if needed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
