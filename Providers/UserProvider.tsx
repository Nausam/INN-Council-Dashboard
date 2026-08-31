"use client";

import { useAuth, useUser as useClerkUser } from "@clerk/nextjs";
import { createContext, useContext, useMemo } from "react";

import type { AuthProfile } from "@/lib/auth/session-claims";
import { isAdminFromSessionClaims } from "@/lib/auth/session-claims";

const UserContext = createContext({
  currentUser: null as AuthProfile | null,
  isAdmin: false,
  loading: true,
});

export const useUser = () => useContext(UserContext);

function readAdminFromUser(user: {
  publicMetadata?: unknown;
  privateMetadata?: unknown;
  unsafeMetadata?: unknown;
} | null): boolean | null {
  if (!user) return null;

  for (const value of [
    user.publicMetadata,
    user.privateMetadata,
    user.unsafeMetadata,
  ]) {
    if (!value || typeof value !== "object") continue;
    const role = (value as Record<string, unknown>).role;
    if (role === "admin") return true;
    if (typeof role === "string") return false;
  }

  return null;
}

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useClerkUser();
  const auth = useAuth() as { sessionClaims?: Record<string, unknown> | null };

  const isAdmin = useMemo(() => {
    const fromClaims = isAdminFromSessionClaims(auth.sessionClaims ?? null);
    if (fromClaims) return true;
    return readAdminFromUser(clerkUser ?? null) === true;
  }, [auth.sessionClaims, clerkUser]);

  const currentUser = useMemo((): AuthProfile | null => {
    if (!clerkUser) return null;

    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";

    const fullName =
      clerkUser.fullName?.trim() ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      email ||
      "User";

    return {
      id: clerkUser.id,
      fullName,
      email,
      isAdmin,
    };
  }, [clerkUser, isAdmin]);

  const loading = !isLoaded || (Boolean(isSignedIn) && !clerkUser);

  return (
    <UserContext.Provider value={{ currentUser, isAdmin, loading }}>
      {children}
    </UserContext.Provider>
  );
};
