import { auth, currentUser } from "@clerk/nextjs/server";

import { isAnyEmailAllowed } from "@/lib/auth/allowed-emails";

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const emails = user.emailAddresses.map((email) => email.emailAddress);
  if (!isAnyEmailAllowed(emails) || user.privateMetadata?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}

export function adminErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}
