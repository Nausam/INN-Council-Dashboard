export function emailsFromClaims(
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
      emails.push(value.trim().toLowerCase());
    }
  }
  return Array.from(new Set(emails));
}

export function roleFromSessionClaims(
  sessionClaims?: Record<string, unknown> | null,
): string | null {
  if (!sessionClaims) return null;

  const direct = sessionClaims.role;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  for (const key of ["metadata", "publicMetadata", "privateMetadata"]) {
    const value = sessionClaims[key];
    if (!value || typeof value !== "object") continue;
    const role = (value as Record<string, unknown>).role;
    if (typeof role === "string" && role.trim()) return role.trim();
  }

  return null;
}

export function nameFromSessionClaims(
  sessionClaims?: Record<string, unknown> | null,
  fallbackEmail = "",
): string {
  if (!sessionClaims) return fallbackEmail || "User";

  const fullName = sessionClaims.fullName ?? sessionClaims.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  const name = sessionClaims.name;
  if (typeof name === "string" && name.trim()) return name.trim();

  const first =
    typeof sessionClaims.firstName === "string"
      ? sessionClaims.firstName
      : typeof sessionClaims.first_name === "string"
        ? sessionClaims.first_name
        : "";
  const last =
    typeof sessionClaims.lastName === "string"
      ? sessionClaims.lastName
      : typeof sessionClaims.last_name === "string"
        ? sessionClaims.last_name
        : "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || fallbackEmail || "User";
}

export function isAdminFromSessionClaims(
  sessionClaims?: Record<string, unknown> | null,
): boolean {
  return roleFromSessionClaims(sessionClaims) === "admin";
}

export type AuthProfile = {
  id: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
};
