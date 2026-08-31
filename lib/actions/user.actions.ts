"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import type { AuthProfile } from "@/lib/auth/session-claims";
import { parseStringify } from "@/lib/utils";

export type { AuthProfile };

export async function getAuthProfile(): Promise<AuthProfile | null> {
  const profile = await getSessionAuthProfile();
  return profile ? parseStringify(profile) : null;
}

/** @deprecated Use getAuthProfile */
export async function getCurrentUser() {
  const profile = await getAuthProfile();
  if (!profile) return null;
  return parseStringify({
    $id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    isAdmin: profile.isAdmin,
  });
}

export async function signOutUser() {
  const { sessionId } = await auth();
  if (sessionId) {
    await clerkClient().sessions.revokeSession(sessionId);
  }
}

export async function createAccount() {
  return parseStringify({
    error: "Sign up is disabled. Contact the council administrator for access.",
  });
}

export async function signInUser() {
  return parseStringify({
    error: "Sign in is handled by Clerk at /sign-in",
  });
}
