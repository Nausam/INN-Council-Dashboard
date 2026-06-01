"use client";

import {
  councilSidebarNav,
  type SidebarNavItem,
} from "@/lib/navigation/sidebar-config";
import { sidebar } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { useCouncilSidebar } from "./sidebar-context";

function getMostSpecificMatchingChildUrl(
  pathname: string,
  children: { url: string }[] | undefined,
): string | null {
  if (!children?.length) return null;
  let best: string | null = null;
  let bestLen = -1;

  for (const { url } of children) {
    if (!url || url === "#") continue;

    if (url === "/") {
      if (pathname === "/" && 1 > bestLen) {
        best = "/";
        bestLen = 1;
      }
      continue;
    }

    const exact = pathname === url;
    const nested = pathname.startsWith(url + "/");
    if (exact || nested) {
      if (url.length > bestLen) {
        best = url;
        bestLen = url.length;
      }
    }
  }

  return best;
}

function isSectionActive(pathname: string, item: SidebarNavItem) {
  if (item.url && item.url !== "#") {
    if (pathname === item.url) return true;
    if (pathname.startsWith(item.url + "/")) return true;
  }
  return getMostSpecificMatchingChildUrl(pathname, item.items) != null;
}

type NavSectionProps = {
  item: SidebarNavItem;
  pathname: string;
  iconOnly: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
};

const NavSection = React.memo(function NavSection({
  item,
  pathname,
  iconOnly,
  isOpen,
  onToggle,
  onNavigate,
}: NavSectionProps) {
  const Icon = item.icon;
  const active = isSectionActive(pathname, item);
  const hasChildren = !!item.items?.length;
  const activeChildUrl = hasChildren
    ? getMostSpecificMatchingChildUrl(pathname, item.items)
    : null;

  const rowClass = cn(
    sidebar.navItem,
    iconOnly ? sidebar.navItemIconOnly : sidebar.navItemExpanded,
    active && sidebar.navItemActive,
  );

  const content = (
    <>
      {active && !iconOnly && (
        <span className="council-nav-active-bar absolute left-0 top-1/2 h-6 w-[3px] rounded-r-full bg-teal-500" />
      )}
      <span
        className={cn(
          sidebar.navIconWrap,
          active && sidebar.navIconWrapActive,
        )}
      >
        <Icon
          className={cn(
            sidebar.navIcon,
            active && sidebar.navIconActive,
          )}
          strokeWidth={2.1}
        />
      </span>
      {!iconOnly && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
          {hasChildren && (
            <ChevronRight
              className={cn(
                "ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out",
                isOpen && "rotate-90 text-teal-600",
              )}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <div>
      {hasChildren ? (
        iconOnly ? (
          <Link
            href={item.items![0]!.url}
            className={rowClass}
            title={item.title}
            onClick={onNavigate}
          >
            {content}
          </Link>
        ) : (
          <button type="button" className={rowClass} onClick={onToggle}>
            {content}
          </button>
        )
      ) : (
        <Link
          href={item.url}
          className={rowClass}
          title={iconOnly ? item.title : undefined}
          onClick={onNavigate}
        >
          {content}
        </Link>
      )}

      {hasChildren && !iconOnly && (
        <div
          className={cn("council-subnav-grid", sidebar.subnavBorder)}
          data-open={isOpen ? "true" : "false"}
        >
          <div className="council-subnav-inner">
            <ul className="space-y-0.5 py-1">
              {item.items!.map((sub) => {
                const subActive = activeChildUrl === sub.url;
                return (
                  <li key={sub.title} className="council-subnav-item">
                    <Link
                      href={sub.url}
                      onClick={onNavigate}
                      className={cn(
                        sidebar.subnavItem,
                        subActive && sidebar.subnavItemActive,
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-[background-color,transform] duration-200",
                          subActive
                            ? "scale-125 bg-teal-500"
                            : "bg-slate-300 group-hover/sub:bg-teal-300",
                        )}
                      />
                      <span className="truncate">{sub.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

export function CouncilSidebarNav() {
  const pathname = usePathname();
  const { collapsed, isMobile, setMobileOpen } = useCouncilSidebar();
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [enterPhase, setEnterPhase] = React.useState<"idle" | "active" | "done">(
    "idle",
  );
  const iconOnly = collapsed && !isMobile;

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setEnterPhase("active"));
    return () => cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    if (enterPhase !== "active") return;
    const timer = window.setTimeout(() => setEnterPhase("done"), 720);
    return () => window.clearTimeout(timer);
  }, [enterPhase]);

  React.useEffect(() => {
    setOpen((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const item of councilSidebarNav) {
        if (
          item.items?.length &&
          isSectionActive(pathname, item) &&
          !next[item.title]
        ) {
          next[item.title] = true;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [pathname]);

  const closeMobile = React.useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile, setMobileOpen]);

  return (
    <nav
      className={cn(
        "council-nav-enter space-y-0.5 px-2 py-3",
        enterPhase === "active" && "council-nav-enter-active",
        enterPhase === "done" && "council-nav-enter-done",
      )}
    >
      {councilSidebarNav.map((item) => (
        <NavSection
          key={item.title}
          item={item}
          pathname={pathname}
          iconOnly={iconOnly}
          isOpen={!!open[item.title]}
          onToggle={() =>
            setOpen((prev) => ({ ...prev, [item.title]: !prev[item.title] }))
          }
          onNavigate={closeMobile}
        />
      ))}
    </nav>
  );
}
