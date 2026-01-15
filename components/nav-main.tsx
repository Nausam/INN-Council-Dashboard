"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export type NavMainItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: { title: string; url: string }[];
};

function isSectionActive(pathname: string, item: NavMainItem) {
  if (item.url && item.url !== "#") {
    if (pathname === item.url) return true;
    if (pathname.startsWith(item.url + "/")) return true;
  }
  if (
    item.items?.some(
      (x) => pathname === x.url || pathname.startsWith(x.url + "/")
    )
  )
    return true;
  return false;
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      if (item.items?.length && isSectionActive(pathname, item)) {
        next[item.title] = true;
      }
    }
    setOpen((prev) => ({ ...prev, ...next }));
  }, [pathname, items]);

  return (
    <nav
      className={cn(
        "py-2 transition-all duration-200",
        collapsed ? "px-2" : "px-4"
      )}
    >
      <ul
        className={cn(
          "transition-all duration-200",
          collapsed ? "space-y-2 flex flex-col items-center" : "space-y-1"
        )}
      >
        {items.map((item) => {
          const active = isSectionActive(pathname, item);
          const Icon = item.icon;
          const hasChildren = !!item.items?.length;
          const isOpen = !!open[item.title];
          const showChildren = !collapsed && hasChildren && (isOpen || active);

          // Collapsed (icon-only) style - optimized for performance
          const iconOnlyBtn = cn(
            "group relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out",
            active
              ? "bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/30"
              : "text-slate-500 hover:bg-slate-100 hover:shadow-md"
          );

          // Expanded (full) style - optimized for performance
          const fullRowBtn = cn(
            "group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-200 ease-out overflow-hidden",
            active
              ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30"
              : "text-slate-700 hover:bg-slate-100 hover:shadow-md"
          );

          const iconClass = cn(
            "h-5 w-5 transition-colors duration-200 ease-out",
            active ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
          );

          const chevronClass = cn(
            "ml-auto h-4 w-4 transition-transform duration-200 ease-out",
            active
              ? "text-white/90"
              : "text-slate-400 group-hover:text-indigo-600",
            showChildren ? "rotate-180" : "rotate-0"
          );

          // --- COLLAPSED (icon-only) ---
          if (collapsed) {
            if (hasChildren) {
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    className={iconOnlyBtn}
                    title={item.title}
                    aria-label={item.title}
                    onClick={() => {
                      const first = item.items?.[0]?.url;
                      if (first) window.location.href = first;
                    }}
                  >
                    {Icon ? <Icon className={iconClass} /> : null}
                  </button>
                </li>
              );
            }

            return (
              <li key={item.title}>
                <Link
                  href={item.url}
                  className={iconOnlyBtn}
                  title={item.title}
                  aria-label={item.title}
                >
                  {Icon ? <Icon className={iconClass} /> : null}
                </Link>
              </li>
            );
          }

          // --- EXPANDED (normal) ---
          return (
            <li key={item.title}>
              {hasChildren ? (
                <button
                  type="button"
                  className={fullRowBtn}
                  onClick={() =>
                    setOpen((prev) => ({
                      ...prev,
                      [item.title]: !prev[item.title],
                    }))
                  }
                >
                  {Icon ? (
                    <div className="relative">
                      <Icon className={iconClass} />
                    </div>
                  ) : null}
                  <span className="truncate">{item.title}</span>
                  <ChevronDown className={chevronClass} />
                  {active && (
                    <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white/30" />
                  )}
                </button>
              ) : (
                <Link href={item.url} className={fullRowBtn}>
                  {Icon ? (
                    <div className="relative">
                      <Icon className={iconClass} />
                    </div>
                  ) : null}
                  <span className="truncate">{item.title}</span>
                  {active && (
                    <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white/30" />
                  )}
                </Link>
              )}

              {/* Animated dropdown children */}
              {showChildren && (
                <div className="mt-2 space-y-1 overflow-hidden pl-12">
                  {item.items!.map((sub, index) => {
                    const subActive =
                      pathname === sub.url ||
                      pathname.startsWith(sub.url + "/");
                    return (
                      <Link
                        key={sub.title}
                        href={sub.url}
                        className={cn(
                          "group/sub relative block overflow-hidden rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                          subActive
                            ? "bg-indigo-50 text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        {/* Dot indicator */}
                        <div className="relative z-10 flex items-center gap-3">
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full transition-all duration-200",
                              subActive
                                ? "bg-indigo-600 shadow-lg shadow-indigo-500/50"
                                : "bg-slate-300 group-hover/sub:bg-indigo-400"
                            )}
                          />
                          <span>{sub.title}</span>
                        </div>

                        {/* Active bar */}
                        {subActive && (
                          <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
