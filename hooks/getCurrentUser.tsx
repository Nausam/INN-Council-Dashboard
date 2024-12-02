"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/actions/user.actions";

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);

        // Check if the user has the "admin" label
        if (user?.labels?.includes("admin")) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { currentUser, loading, isAdmin };
};
