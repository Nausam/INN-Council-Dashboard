"use client";

import { useUser as useClerkUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import {
  getAuthProfile,
  type AuthProfile,
} from "@/lib/actions/user.actions";

export const useCurrentUser = () => {
  const { user: clerkUser, isLoaded } = useClerkUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!clerkUser) {
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
  }, [isLoaded, clerkUser?.id]);

  const currentUser: AuthProfile | null = clerkUser
    ? {
        id: clerkUser.id,
        fullName:
          clerkUser.fullName?.trim() ||
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
          clerkUser.primaryEmailAddress?.emailAddress ||
          "User",
        email:
          clerkUser.primaryEmailAddress?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          "",
        isAdmin,
      }
    : null;

  const loading = !isLoaded || (Boolean(clerkUser) && !adminChecked);

  return { currentUser, loading, isAdmin };
};
