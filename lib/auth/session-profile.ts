import { auth } from "@clerk/nextjs/server";

import {
  isAnyEmailAllowed,
  resolveUserEmails,
  resolveUserRole,
} from "@/lib/auth/allowed-emails";
import { nameFromSessionClaims, type AuthProfile } from "@/lib/auth/session-claims";

export type { AuthProfile };

export async function getSessionAuthProfile(): Promise<AuthProfile | null> {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) return null;

    const claims = (sessionClaims ?? null) as Record<string, unknown> | null;
    const emails = await resolveUserEmails(userId, claims);
    if (!isAnyEmailAllowed(emails)) return null;

    const email = emails[0] ?? "";
    const role = await resolveUserRole(userId, claims);
    return {
      id: userId,
      fullName: nameFromSessionClaims(claims, email),
      email,
      isAdmin: role === "admin",
    };
  } catch {
    return null;
  }
}
