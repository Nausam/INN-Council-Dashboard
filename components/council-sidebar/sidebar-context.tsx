"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import * as React from "react";

type CouncilSidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  isMobile: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
};

const CouncilSidebarContext =
  React.createContext<CouncilSidebarContextValue | null>(null);

const STORAGE_KEY = "council-sidebar-collapsed";

export function CouncilSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleMobile = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  React.useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const value = React.useMemo(
    () => ({
      collapsed,
      mobileOpen,
      isMobile,
      toggleCollapsed,
      setMobileOpen,
      toggleMobile,
    }),
    [collapsed, mobileOpen, isMobile, toggleCollapsed, toggleMobile],
  );

  return (
    <CouncilSidebarContext.Provider value={value}>
      {children}
    </CouncilSidebarContext.Provider>
  );
}

export function useCouncilSidebar() {
  const ctx = React.useContext(CouncilSidebarContext);
  if (!ctx) {
    throw new Error(
      "useCouncilSidebar must be used within CouncilSidebarProvider",
    );
  }
  return ctx;
}
