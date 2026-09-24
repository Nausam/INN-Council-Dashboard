"use client";

import { FamilyLeaveRequestDialog } from "@/components/Leave/FamilyLeaveRequestDialog";
import { EmployeeRequestDialog } from "@/components/employee-portal/EmployeeRequestDialog";
import type { EmployeeDoc } from "@/lib/firebase/types";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CalendarRange,
  Clock3,
  FileText,
  HeartPulse,
  LayoutGrid,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "./requests-page.module.css";

type RequestKind = "salaam" | "family" | "annual" | "ot";

const requestChoices: Array<{
  kind: RequestKind;
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { kind: "salaam", title: "Salaam", detail: "Sick leave", icon: HeartPulse },
  { kind: "family", title: "Family leave", detail: "Family related", icon: UsersRound },
  { kind: "annual", title: "Annual leave", detail: "Planned time off", icon: CalendarRange },
  { kind: "ot", title: "OT", detail: "Overtime work", icon: Clock3 },
];

export function EmployeeRequestsPageView({
  employee,
  employeeId,
}: {
  employee: EmployeeDoc | null;
  employeeId: string;
}) {
  const [activeRequest, setActiveRequest] = useState<RequestKind | null>(null);
  const dashboard = `/employees/details/${employeeId}`;

  if (!employee) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <Link href="/employees/details" className={styles.back}>
            <ArrowLeft size={18} /> Back
          </Link>
          <h1 className={styles.missing}>Employee not found</h1>
        </div>
      </div>
    );
  }

  const remaining: Record<RequestKind, string> = {
    salaam: `${employee.sickLeave ?? 0} days left`,
    family: `${employee.familyRelatedLeave ?? 0} days left`,
    annual: `${employee.annualLeave ?? 0} days left`,
    ot: "Request extra hours",
  };

  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className={styles.wrap}>
        <header className={styles.topbar}>
          <Link href={dashboard} className={styles.back} aria-label="Back to employee profile">
            <ArrowLeft size={18} />
          </Link>
          <span className={styles.topTitle}>Employee portal</span>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>Your workspace</span>
          <h1>Requests</h1>
          <p>{employee.name}</p>
        </section>

        <nav className={styles.desktopNav} aria-label="Employee portal sections">
          <Link href={`${dashboard}?tab=overview`}><LayoutGrid size={17} />Overview</Link>
          <Link href={`${dashboard}?tab=attendance`}><Clock3 size={17} />Attend</Link>
          <Link href={`${dashboard}?tab=leave`}><WalletCards size={17} />Leave</Link>
          <Link href={`${dashboard}?tab=pay`}><Banknote size={17} />Pay</Link>
          <span aria-current="page"><FileText size={17} />Requests</span>
        </nav>

        <div className={styles.sectionHead}>
          <h2>Choose a request</h2>
          <span>04 options</span>
        </div>
        <div className={styles.requestGrid}>
          {requestChoices.map(({ kind, title, detail, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              data-kind={kind}
              className={styles.requestCard}
              onClick={() => setActiveRequest(kind)}
            >
              <span className={styles.cardTop}>
                <span className={styles.cardIcon}><Icon size={20} /></span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </span>
              <span className={styles.cardBody}>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <span className={styles.cardFoot}>{remaining[kind]}</span>
            </button>
          ))}
        </div>

        <Link href={`/employees/${employeeId}/leaves`} className={styles.calendarLink}>
          <span><CalendarDays size={18} /> Leave calendar</span>
          <ArrowUpRight size={18} />
        </Link>
      </div>

      <nav className={styles.mobileNav} aria-label="Employee portal sections">
        <Link href={`${dashboard}?tab=overview`}><LayoutGrid /><span>Overview</span></Link>
        <Link href={`${dashboard}?tab=attendance`}><Clock3 /><span>Attend</span></Link>
        <Link href={`${dashboard}?tab=leave`}><WalletCards /><span>Leave</span></Link>
        <Link href={`${dashboard}?tab=pay`}><Banknote /><span>Pay</span></Link>
        <span className={styles.mobileActive} aria-current="page"><FileText /><span>Requests</span></span>
      </nav>

      <FamilyLeaveRequestDialog
        employeeId={employeeId}
        presetLeaveType={activeRequest === "family" ? "family" : "salaam"}
        open={activeRequest === "salaam" || activeRequest === "family"}
        onOpenChange={(open) => { if (!open) setActiveRequest(null); }}
      />
      <EmployeeRequestDialog
        employeeId={employeeId}
        mode={activeRequest === "ot" ? "ot" : "annual"}
        open={activeRequest === "annual" || activeRequest === "ot"}
        onOpenChange={(open) => { if (!open) setActiveRequest(null); }}
      />
    </div>
  );
}
