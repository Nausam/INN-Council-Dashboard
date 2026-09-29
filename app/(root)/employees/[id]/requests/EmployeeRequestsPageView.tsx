"use client";

import type { EmployeeDoc } from "@/lib/firebase/types";
import { EmployeeRequestHistory } from "@/components/employee-portal/EmployeeRequestHistory";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
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
import dynamic from "next/dynamic";
import { useState } from "react";
import styles from "./requests-page.module.css";

type RequestKind = "salaam" | "family" | "annual" | "ot";
type DashboardTab = "overview" | "attendance" | "leave" | "pay" | "requests";

const FamilyLeaveRequestDialog = dynamic(() =>
  import("@/components/Leave/FamilyLeaveRequestDialog").then(
    (module) => module.FamilyLeaveRequestDialog,
  ),
);
const EmployeeRequestDialog = dynamic(() =>
  import("@/components/employee-portal/EmployeeRequestDialog").then(
    (module) => module.EmployeeRequestDialog,
  ),
);

const portalSections: Array<{
  id: Exclude<DashboardTab, "requests">;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "attendance", label: "Attend", icon: Clock3 },
  { id: "leave", label: "Leave", icon: WalletCards },
  { id: "pay", label: "Pay", icon: Banknote },
];

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
  onTabChange,
}: {
  employee: EmployeeDoc | null;
  employeeId: string;
  onTabChange?: (tab: DashboardTab) => void;
}) {
  const [activeRequest, setActiveRequest] = useState<RequestKind | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const dashboard = `/employees/details/${employeeId}`;
  const renderPortalSection = (
    { id, label, icon: Icon }: (typeof portalSections)[number],
    mobile: boolean,
  ) => {
    const content = <><Icon size={mobile ? undefined : 17} />{mobile ? <span>{label}</span> : label}</>;
    return onTabChange ? (
      <button key={id} type="button" onClick={() => onTabChange(id)}>{content}</button>
    ) : (
      <Link key={id} href={`${dashboard}?tab=${id}`}>{content}</Link>
    );
  };

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
          <span className={styles.topTitle}>Employee Profile</span>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>Your workspace</span>
          <h1>Requests</h1>
          <p>{employee.name}</p>
        </section>

        <nav className={styles.desktopNav} aria-label="Employee profile sections">
          {portalSections.map((section) => renderPortalSection(section, false))}
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

        <EmployeeRequestHistory employeeId={employeeId} revision={historyRevision} />
      </div>

      <nav className={styles.mobileNav} aria-label="Employee profile sections">
        {portalSections.map((section) => renderPortalSection(section, true))}
        <span className={styles.mobileActive} aria-current="page"><FileText /><span>Requests</span></span>
      </nav>

      {activeRequest === "salaam" || activeRequest === "family" ? (
        <FamilyLeaveRequestDialog
          employeeId={employeeId}
          presetLeaveType={activeRequest}
          open
          onSubmitted={() => setHistoryRevision((value) => value + 1)}
          onOpenChange={(open) => { if (!open) setActiveRequest(null); }}
        />
      ) : null}
      {activeRequest === "annual" || activeRequest === "ot" ? (
        <EmployeeRequestDialog
          employeeId={employeeId}
          mode={activeRequest}
          open
          onSubmitted={() => setHistoryRevision((value) => value + 1)}
          onOpenChange={(open) => { if (!open) setActiveRequest(null); }}
        />
      ) : null}
    </div>
  );
}
