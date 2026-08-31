import { getSessionAuthProfile } from "@/lib/auth/session-profile";

export async function requireAdmin() {
  const profile = await getSessionAuthProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (!profile.isAdmin) {
    throw new Error("Forbidden");
  }
  return profile;
}

export function adminErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}
