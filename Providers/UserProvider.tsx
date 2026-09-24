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

  const currentUser = useMemo((): AuthProfile | null => {
    if (!clerkUser) return null;

    if (serverProfile) return serverProfile;

    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";

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
  }, [clerkUser, isAdmin, serverProfile]);

  const loading =
    !isLoaded || (Boolean(isSignedIn) && (!clerkUser || !sessionKey || resolved?.key !== sessionKey));

  return (
    <UserContext.Provider value={{ currentUser, isAdmin, loading }}>
      {children}
    </UserContext.Provider>
  );
};
