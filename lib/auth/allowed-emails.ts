import { clerkClient } from "@clerk/nextjs/server";

import { roleFromSessionClaims } from "@/lib/auth/session-claims";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseEmailList(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function getAdminEmails(): Set<string> {
  return parseEmailList(process.env.ADMIN_EMAILS ?? "");
}

export function getAllowedLoginEmails(): Set<string> {
  const allowed = parseEmailList(process.env.ALLOWED_LOGIN_EMAILS ?? "");
  getAdminEmails().forEach((email) => allowed.add(email));
  return allowed;
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

export function emailsFromSessionClaims(
  sessionClaims?: Record<string, unknown> | null,
): string[] {
  if (!sessionClaims) return [];
  const candidates = [
    sessionClaims.email,
    sessionClaims.primary_email_address,
    sessionClaims.primaryEmail,
    sessionClaims.email_address,
    sessionClaims.emailAddress,
  ];
  const emails: string[] = [];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      emails.push(value);
    }
  }

  for (const key of ["emails", "email_addresses", "emailAddresses"]) {
    const value = sessionClaims[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) {
        emails.push(entry);
      } else if (
        entry &&
        typeof entry === "object" &&
        "emailAddress" in entry &&
        typeof entry.emailAddress === "string" &&
        entry.emailAddress.trim()
      ) {
        emails.push(entry.emailAddress);
      }
    }
  }

  return Array.from(new Set(emails.map(normalizeEmail)));
}

type EmailCacheEntry = {
  verifiedEmails: string[];
  role: string | null;
  expiresAt: number;
};

const EMAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const emailCache = new Map<string, EmailCacheEntry>();

async function loadClerkUserSnapshot(userId: string): Promise<EmailCacheEntry> {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const verifiedEmails = user.emailAddresses
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => normalizeEmail(entry.emailAddress))
    .filter(Boolean);
  const role =
    typeof user.privateMetadata?.role === "string"
      ? user.privateMetadata.role
      : typeof user.publicMetadata?.role === "string"
        ? user.publicMetadata.role
        : null;
  const entry = {
    verifiedEmails,
    role,
    expiresAt: Date.now() + EMAIL_CACHE_TTL_MS,
  };
  emailCache.set(userId, entry);
  return entry;
}

export async function resolveUserEmails(
  userId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<string[]> {
  const claimEmails = emailsFromSessionClaims(sessionClaims);
  const regularAllowed = parseEmailList(process.env.ALLOWED_LOGIN_EMAILS ?? "");
  const allowedClaimEmails = claimEmails.filter((email) => regularAllowed.has(email));
  if (allowedClaimEmails.length > 0) return allowedClaimEmails;

  try {
    const snapshot = await loadClerkUserSnapshot(userId);
    return snapshot.verifiedEmails;
  } catch {
    return allowedClaimEmails;
  }
}

export async function resolveUserRole(
  userId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<string | null> {
  const adminEmails = getAdminEmails();
  if (adminEmails.size > 0) {
    try {
      const snapshot = await loadClerkUserSnapshot(userId);
      return snapshot.verifiedEmails.some((email) => adminEmails.has(email))
        ? "admin"
        : "user";
    } catch {
      return "user";
    }
  }

  const claimRole = roleFromSessionClaims(sessionClaims);
  if (claimRole) return claimRole;

  try {
    const snapshot = await loadClerkUserSnapshot(userId);
    return snapshot.role;
  } catch {
    return null;
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
