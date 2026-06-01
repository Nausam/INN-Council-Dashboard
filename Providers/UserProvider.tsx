"use client";

import { useUser as useClerkUser } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getAuthProfile, type AuthProfile } from "@/lib/actions/user.actions";

const UserContext = createContext({
  currentUser: null as AuthProfile | null,
  isAdmin: false,
  loading: true,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useClerkUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }

    let cancelled = false;
    setAdminChecked(false);

    getAuthProfile()
      .then((profile) => {
        if (!cancelled) setIsAdmin(Boolean(profile?.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setAdminChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, clerkUser?.id]);

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

  const loading = !isLoaded || (Boolean(clerkUser) && !adminChecked);

  return (
    <UserContext.Provider value={{ currentUser, isAdmin, loading }}>
      {children}
    </UserContext.Provider>
  );
};
