/**
 * Grant Clerk privateMetadata.role = "admin" to the most recently signed-in user.
 * Usage: npm run grant:admin
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

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is missing");
  }

  const clerk = createClerkClient({ secretKey });
  const { data: users } = await clerk.users.getUserList({ limit: 100 });

  if (users.length === 0) {
    throw new Error("No Clerk users found");
  }

  const sorted = [...users].sort((a, b) => {
    const aTime = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
    const bTime = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
    return bTime - aTime;
  });

  const target = sorted[0];
  const email = target.emailAddresses[0]?.emailAddress ?? target.id;

  await clerk.users.updateUser(target.id, {
    privateMetadata: { ...target.privateMetadata, role: "admin" },
  });

  console.log(`Granted admin to ${email} (${target.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
