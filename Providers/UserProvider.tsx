"use client";

import { useAuth, useUser as useClerkUser } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getAuthProfile } from "@/lib/actions/user.actions";
import type { AuthProfile } from "@/lib/auth/session-claims";

const UserContext = createContext({
  currentUser: null as AuthProfile | null,
  isAdmin: false,
  loading: true,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useClerkUser();
  const { sessionId } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    profile: AuthProfile | null;
  } | null>(null);
  const sessionKey = clerkUser ? `${clerkUser.id}:${sessionId ?? "active"}` : null;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionKey) return;
    let active = true;
    void getAuthProfile()
      .then((profile) => {
        if (active) setResolved({ key: sessionKey, profile });
      })
      .catch(() => {
        if (active) setResolved({ key: sessionKey, profile: null });
      });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, sessionKey]);

  const serverProfile = resolved?.key === sessionKey ? resolved.profile : null;
  const isAdmin = serverProfile?.isAdmin ?? false;

  // Clerk hands out a new user object on every session refresh and window
  // focus; depend on its fields so consumers (whole pages) don't re-render.
  const clerkUserId = clerkUser?.id ?? null;
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const clerkFullName =
    clerkUser?.fullName?.trim() ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();

  const currentUser = useMemo((): AuthProfile | null => {
    if (!clerkUserId) return null;

    if (serverProfile) return serverProfile;

    return {
      id: clerkUserId,
      fullName: clerkFullName || clerkEmail || "User",
      email: clerkEmail,
      isAdmin,
    };
  }, [clerkUserId, clerkFullName, clerkEmail, isAdmin, serverProfile]);

  const loading =
    !isLoaded || (Boolean(isSignedIn) && (!clerkUser || !sessionKey || resolved?.key !== sessionKey));

  const value = useMemo(
    () => ({ currentUser, isAdmin, loading }),
    [currentUser, isAdmin, loading],
  );

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
