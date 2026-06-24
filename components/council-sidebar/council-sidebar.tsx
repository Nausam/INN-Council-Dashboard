"use client";

import { CouncilSidebarNav } from "@/components/council-sidebar/sidebar-nav";
import { CouncilSidebarUser } from "@/components/council-sidebar/sidebar-user";
import { useCouncilSidebar } from "@/components/council-sidebar/sidebar-context";
import { IconButton } from "@/components/design-system";
import { pageBackground, sidebar, typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Image from "next/image";

export const SIDEBAR_WIDTH_EXPANDED = sidebar.widthExpanded;
export const SIDEBAR_WIDTH_COLLAPSED = sidebar.widthCollapsed;

function SidebarPanel({ className }: { className?: string }) {
  const { collapsed, isMobile, toggleCollapsed, setMobileOpen } =
    useCouncilSidebar();
  const iconOnly = collapsed && !isMobile;

  return (
    <aside className={cn(sidebar.panel, className)}>
      <div
        className={cn(
          sidebar.header,
          iconOnly
            ? "flex flex-col items-center gap-3"
            : "relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 pr-12",
        )}
      >
        <div className={sidebar.brandIcon}>
          <Image
            src="/assets/icons/logo.png"
            alt="Innamaadhoo Council"
            width={24}
            height={24}
            className="object-contain"
            priority
          />
        </div>

        {!iconOnly && (
          <div className="min-w-0">
            <p className={typography.sidebarOverline}>Innamaadhoo</p>
            <p className={typography.sidebarTitle}>Council Dashboard</p>
          </div>
        )}

        {isMobile ? (
          <IconButton
            icon={X}
            label="Close menu"
            variant="ghost"
            size="sm"
            className={cn(
              iconOnly ? "mx-auto" : "absolute right-3 top-1/2 -translate-y-1/2",
            )}
            onClick={() => setMobileOpen(false)}
          />
        ) : (
          <IconButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            variant="ghost"
            size="sm"
            className={cn(
              iconOnly
                ? "mx-auto"
                : "absolute right-3 top-1/2 -translate-y-1/2",
            )}
            onClick={toggleCollapsed}
          />
        )}
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto council-sidebar-scroll">
        <CouncilSidebarNav />
      </div>

      <div className={sidebar.footer}>
        <CouncilSidebarUser />
      </div>
    </aside>
  );
}

export function CouncilSidebar() {
  const { collapsed, isMobile, mobileOpen, setMobileOpen } =
    useCouncilSidebar();

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu backdrop"
            className="council-sidebar-backdrop fixed inset-0 z-40 bg-slate-900/20"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={cn(
            "council-mobile-drawer fixed inset-y-0 left-0 z-50 w-[min(88vw,19rem)]",
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          )}
        >
          <SidebarPanel className="h-full border-r border-slate-200/80" />
        </div>
      </>
    );
  }

  return (
    <div
      className="council-sidebar-shell fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-slate-200/80 md:block"
      style={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
      }}
    >
      <SidebarPanel className="h-full" />
    </div>
  );
}

export function CouncilMainFrame({ children }: { children: React.ReactNode }) {
  const { collapsed, isMobile } = useCouncilSidebar();

  const paddingLeft = isMobile
    ? 0
    : collapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div
      className={cn("council-main-frame flex min-w-0 flex-1 flex-col", pageBackground)}
      style={{ paddingLeft }}
    >
      {children}
    </div>
  );
}

export function CouncilMobileHeader() {
  const { isMobile, toggleMobile } = useCouncilSidebar();

  if (!isMobile) return null;

  return (
    <header className={sidebar.mobileHeader} data-council-mobile-header>
      <IconButton
        icon={Menu}
        label="Open menu"
        onClick={toggleMobile}
      />
      <div className="min-w-0 flex-1">
        <p className={typography.sidebarOverline}>Innamaadhoo Council</p>
        <p className={typography.sidebarTitle}>Dashboard</p>
      </div>
    </header>
  );
}
