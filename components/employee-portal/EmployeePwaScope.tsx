"use client";

import {
  EMPLOYEE_PROFILE_HOME,
  isEmployeeProfileRoute,
  isStandaloneApp,
} from "@/lib/employee-profile-pwa";
import { renewEmployeeProfileSession } from "@/lib/actions/employee-profile.actions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function EmployeePwaScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [standalone, setStandalone] = useState<boolean | null>(null);
  const allowed = isEmployeeProfileRoute(pathname);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const update = () => setStandalone(isStandaloneApp());
    update();
    if (displayMode.addEventListener) {
      displayMode.addEventListener("change", update);
      return () => displayMode.removeEventListener("change", update);
    }
    displayMode.addListener(update);
    return () => displayMode.removeListener(update);
  }, []);

  // The sign-in stays saved until Log out; keep it from expiring while in use.
  useEffect(() => {
    if (allowed) void renewEmployeeProfileSession().catch(() => {});
  }, [allowed]);

  useEffect(() => {
    document.documentElement.classList.toggle("employee-profile-app", standalone === true);
    if (standalone && !allowed) router.replace(EMPLOYEE_PROFILE_HOME);
    return () => document.documentElement.classList.remove("employee-profile-app");
  }, [allowed, router, standalone]);

  if (standalone === null || (standalone && !allowed)) return null;
  return <>{children}</>;
}
