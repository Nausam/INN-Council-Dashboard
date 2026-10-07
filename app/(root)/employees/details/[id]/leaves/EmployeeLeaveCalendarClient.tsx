"use client";

import { EmployeePortalHeader } from "@/components/employee-portal/EmployeePortalHeader";
import mobileNavStyles from "@/components/employee-portal/EmployeePortalMobileNav.module.css";
import { EmployeePortalMobileNav } from "@/components/employee-portal/EmployeePortalMobileNav";
import { useEmployeeLeaveCalendarQuery, useEmployeeQuery } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { useParams } from "next/navigation";
import { EmployeeLeaveCalendarView } from "../../../[id]/leaves/EmployeeLeaveCalendarView";
import surface from "../../../[id]/employee-portal-surface.module.css";
import styles from "../../../[id]/leaves/leave-calendar.module.css";

/**
 * Reads the employee and their leave days from the query cache, which the
 * profile dashboard fills before the user taps "Leave calendar", so the page
 * shows straight away. A cold visit fetches both and shows a skeleton meanwhile.
 */
export function EmployeeLeaveCalendarClient() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const employeeQuery = useEmployeeQuery(id);
  const leavesQuery = useEmployeeLeaveCalendarQuery(id);

  if (employeeQuery.isPending || leavesQuery.isPending) {
    return <LeaveCalendarSkeleton employeeId={id} />;
  }
  return (
    <EmployeeLeaveCalendarView
      employee={employeeQuery.data ?? null}
      leaves={leavesQuery.data ?? []}
    />
  );
}

function LeaveCalendarSkeleton({ employeeId }: { employeeId?: string }) {
  return (
    <div className={cn(surface.page, mobileNavStyles.pageWithMobileNav, "px-4")} aria-busy="true">
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className={cn(surface.shell, "space-y-5")}>
        <EmployeePortalHeader />

        <section className={cn(surface.hero, styles.hero)}>
          <p className={styles.eyebrow}>
            <CalendarDays className="h-4 w-4" />
            Leave calendar
          </p>
          <div className={styles.heroMain}>
            <span className={cn(styles.skeleton, styles.skeletonAvatar)} />
            <div className="min-w-0 flex-1">
              <span className={cn(styles.skeleton, styles.skeletonName)} aria-label="Loading" />
              <span className={cn(styles.skeleton, styles.skeletonRole)} />
            </div>
          </div>
          <div className={styles.heroStats}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn(surface.softTile, styles.heroStat)}>
                <span className={cn(styles.skeleton, styles.heroStatIcon)} />
                <span className={cn(styles.skeleton, styles.skeletonStat)} />
              </div>
            ))}
          </div>
        </section>

        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.monthHead}>
            <span className={cn(styles.skeleton, styles.skeletonTitle)} />
            <span className={cn(styles.skeleton, styles.skeletonNav)} />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 35 }, (_, i) => (
              <span key={i} className={cn(styles.skeleton, styles.skeletonDay)} />
            ))}
          </div>
        </section>

        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.sectionHead}>
            <span className={cn(styles.skeleton, styles.skeletonTitle)} />
          </div>
          <div className={styles.records}>
            <span className={cn(styles.skeleton, styles.skeletonRecord)} />
            <span className={cn(styles.skeleton, styles.skeletonRecord)} />
          </div>
        </section>
      </div>
      {employeeId ? <EmployeePortalMobileNav employeeId={employeeId} active="leave" /> : null}
    </div>
  );
}
