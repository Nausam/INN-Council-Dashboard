"use client";

import { forgetEmployeeProfileIdentity } from "@/lib/actions/employee-profile.actions";
import { LAST_EMPLOYEE_PROFILE_KEY } from "@/lib/employee-profile-pwa";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./EmployeePortalHeader.module.css";

/**
 * Top bar shared by every Employee Profile page: optional back button, the
 * council logo, any page-specific actions, and Log out.
 */
export function EmployeePortalHeader({
  backHref,
  actions,
  className,
}: {
  /** Where the back button goes; omit on top-level pages. */
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Ends the Employee Profile session and forgets who signed in, so the next
  // visit starts from the ID / record card sign-in.
  const logout = async () => {
    setLoggingOut(true);
    try {
      await forgetEmployeeProfileIdentity();
    } finally {
      try {
        window.localStorage.removeItem(LAST_EMPLOYEE_PROFILE_KEY);
      } catch {
        // Storage may be unavailable; the cleared cookies are what matter.
      }
      router.replace("/employees/details");
      router.refresh();
    }
  };

  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.start}>
        {backHref ? (
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className={styles.iconButton}
            aria-label="Back"
          >
            <ArrowLeft />
          </button>
        ) : null}
        <Image
          src="/council-logo-full.png"
          alt="Raa Innamaadhoo Council"
          width={900}
          height={819}
          className={styles.logo}
          priority
          unoptimized
        />
      </div>
      <div className={styles.end}>
        {actions}
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className={styles.logout}
          aria-label="Log out of Employee Profile"
        >
          {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          <span>Log out</span>
        </button>
      </div>
    </header>
  );
}

/** Round white header button, for page actions such as Edit. */
export function EmployeePortalHeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.actionButton} aria-label={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}
