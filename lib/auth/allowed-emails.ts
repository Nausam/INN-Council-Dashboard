import { clerkClient } from "@clerk/nextjs/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAllowedLoginEmails(): Set<string> {
  const raw = process.env.ALLOWED_LOGIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = getAllowedLoginEmails();
  if (allowed.size === 0 || !email) return false;
  return allowed.has(normalizeEmail(email));
}

export async function resolveUserEmail(
  userId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<string | null> {
  const fromClaims = sessionClaims?.email ?? sessionClaims?.primary_email_address;
  if (typeof fromClaims === "string" && fromClaims) {
    return fromClaims;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null
  );
}
