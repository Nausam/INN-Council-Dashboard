"use client";

import {
  EMPLOYEE_PROFILE_HOME,
  isEmployeeProfileRoute,
  isStandaloneApp,
} from "@/lib/employee-profile-pwa";
import { lockEmployeeProfile } from "@/lib/actions/employee-profile.actions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function EmployeePwaScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [standalone, setStandalone] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [lockError, setLockError] = useState(false);
  const pathnameRef = useRef(pathname);
  const allowed = isEmployeeProfileRoute(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname === EMPLOYEE_PROFILE_HOME) setRedirecting(false);
  }, [pathname]);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    let active = true;
    let hidden = false;
    let locking = false;
    const lockForOpen = async () => {
      if (locking) return;
      locking = true;
      setReady(false);
      setLockError(false);
      try {
        await lockEmployeeProfile();
        if (active) {
          if (pathnameRef.current !== EMPLOYEE_PROFILE_HOME) {
            setRedirecting(true);
            router.replace(EMPLOYEE_PROFILE_HOME);
          }
          setReady(true);
        }
      } catch {
        // Keep employee content hidden if the app cannot lock its old session.
        if (active) {
          setReady(false);
          setLockError(true);
        }
      } finally {
        locking = false;
      }
    };
    const update = () => {
      const installed = isStandaloneApp();
      setStandalone(installed);
      if (installed) void lockForOpen();
      else setReady(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") hidden = true;
      else if (hidden && isStandaloneApp()) {
        hidden = false;
        void lockForOpen();
      }
    };
    update();
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (displayMode.addEventListener) {
      displayMode.addEventListener("change", update);
      return () => {
        active = false;
        displayMode.removeEventListener("change", update);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }
    displayMode.addListener(update);
    return () => {
      active = false;
      displayMode.removeListener(update);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  useEffect(() => {
    document.documentElement.classList.toggle("employee-profile-app", standalone === true);
    if (standalone && !allowed) router.replace(EMPLOYEE_PROFILE_HOME);
    return () => document.documentElement.classList.remove("employee-profile-app");
  }, [allowed, router, standalone]);

  // Hide all routes until the installed app has locked its previous session.
  if (standalone && lockError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p>Could not lock Employee Profile. Connect to the internet and try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-zinc-900 px-5 py-3 font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }
  if (standalone === null || (standalone && (!ready || !allowed || redirecting))) return null;
  return <>{children}</>;
}
