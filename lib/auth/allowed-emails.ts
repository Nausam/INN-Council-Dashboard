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

export function isAnyEmailAllowed(
  emails: Array<string | null | undefined>,
): boolean {
  return emails.some((email) => isEmailAllowed(email));
}

function emailFromSessionClaims(
  sessionClaims?: Record<string, unknown> | null,
): string | null {
  if (!sessionClaims) return null;
  const candidates = [
    sessionClaims.email,
    sessionClaims.primary_email_address,
    sessionClaims.primaryEmail,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

export async function resolveUserEmails(
  userId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<string[]> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.emailAddresses
      .map((entry) => entry.emailAddress)
      .filter(Boolean);
  } catch {
    const claim = emailFromSessionClaims(sessionClaims);
    return claim ? [claim] : [];
  }
}

/** @deprecated Prefer resolveUserEmails for allowlist checks */
export async function resolveUserEmail(
  userId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<string | null> {
  const emails = await resolveUserEmails(userId, sessionClaims);
  return emails[0] ?? null;
}
