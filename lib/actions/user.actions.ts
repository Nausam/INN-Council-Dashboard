"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { parseStringify } from "@/lib/utils";

export type AuthProfile = {
  id: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
};

export async function getAuthProfile(): Promise<AuthProfile | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await currentUser();
    if (!user) return null;
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "";

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      email ||
      "User";

    const isAdmin = user.privateMetadata?.role === "admin";

    return parseStringify({ id: userId, fullName, email, isAdmin });
  } catch {
    return null;
  }
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
    error: "Sign up is handled by Clerk at /sign-up",
  });
}

export async function signInUser() {
  return parseStringify({
    error: "Sign in is handled by Clerk at /sign-in",
  });
}
