"use client";

import type { EmployeeDoc } from "@/lib/firebase/types";
import { EmployeeRequestHistory } from "@/components/employee-portal/EmployeeRequestHistory";
import { EmployeePortalHeader } from "@/components/employee-portal/EmployeePortalHeader";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { LEAVE_TOTAL_ALLOWANCE } from "@/lib/employees/leave-usage";
import { REQUEST_VISUALS, type RequestKind } from "@/lib/employees/request-visuals";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Clock3,
  FileText,
  LayoutGrid,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import styles from "./requests-page.module.css";
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
  /** Employee field holding the days left for this leave, if it has one. */
  balanceKey?: "sickLeave" | "familyRelatedLeave" | "annualLeave";
}> = [
  { kind: "salaam", title: "Salaam", detail: "Sick leave", balanceKey: "sickLeave" },
  { kind: "family", title: "Family leave", detail: "Family related", balanceKey: "familyRelatedLeave" },
  { kind: "annual", title: "Annual leave", detail: "Planned time off", balanceKey: "annualLeave" },
  { kind: "ot", title: "OT", detail: "Overtime work" },
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

  const today = new Date();

  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className={styles.wrap}>
        <EmployeePortalHeader />

        <section className={styles.hero}>
          <div className="min-w-0">
            <span className={styles.eyebrow}>
              <span className={cn(motifs.glossIcon, styles.eyebrowIcon)} data-tone="annual">
                <FileText />
              </span>
              Your workspace
            </span>
            <h1>Requests</h1>
            <p>{employee.name}</p>
          </div>
          <div className={cn(motifs.calendarPage, styles.todayPage)} data-tone="present" aria-hidden="true">
            <span className={motifs.calendarPageTop}>
              {today.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <strong>{today.getDate()}</strong>
            <small>{today.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</small>
          </div>
        </section>

        <nav className={styles.desktopNav} aria-label="Employee profile sections">
          {portalSections.map((section) => renderPortalSection(section, false))}
          <span aria-current="page"><FileText size={17} />Requests</span>
        </nav>

        <div className={styles.sectionHead}>
          <h2>Choose a request</h2>
          <span>4 options</span>
        </div>
        <div className={styles.requestGrid}>
          {requestChoices.map(({ kind, title, detail, balanceKey }) => {
            const visual = REQUEST_VISUALS[kind];
            const Icon = visual.icon;
            const left = balanceKey ? Number(employee[balanceKey] ?? 0) : null;
            const allowance = balanceKey ? LEAVE_TOTAL_ALLOWANCE[balanceKey] ?? null : null;
            return (
              <button
                key={kind}
                type="button"
                data-tone={visual.tone}
                className={styles.requestCard}
                onClick={() => setActiveRequest(kind)}
              >
                <span className={styles.cardTop}>
                  <span className={cn(motifs.glossIcon, styles.cardIcon)} data-tone={visual.tone}>
                    <Icon />
                  </span>
                  <span className={styles.cardArrow} aria-hidden="true">
                    <ArrowUpRight size={16} />
                  </span>
                </span>
                <span className={styles.cardBody}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                {left !== null ? (
                  <span className={styles.cardFoot}>
                    <span className={styles.cardCount}>
                      <b>{left}</b>
                      {allowance ? ` of ${allowance} days left` : " days left"}
                    </span>
                    {allowance ? (
                      <span className={styles.cardMeter}>
                        <span style={{ width: `${Math.min(100, Math.max(0, (left / allowance) * 100))}%` }} />
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className={styles.cardFoot}>
                    <span className={styles.cardCount}>
                      <Clock3 size={14} aria-hidden="true" />
                      Request extra hours
                    </span>
                  </span>
                )}
              </button>
            );
          })}
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
