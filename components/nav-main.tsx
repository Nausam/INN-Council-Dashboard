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
  url: string; // use "#" for expandable sections
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
  const { state } = useSidebar(); // "expanded" | "collapsed"
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
    <nav className={cn("py-2", collapsed ? "px-2" : "px-4")}>
      <ul className={cn("space-y-2", collapsed && "space-y-3")}>
        {items.map((item) => {
          const active = isSectionActive(pathname, item);
          const Icon = item.icon;
          const hasChildren = !!item.items?.length;
          const isOpen = !!open[item.title];
          const showChildren = !collapsed && hasChildren && (isOpen || active);

          const iconOnlyBtn = cn(
            "group flex h-11 w-11 items-center justify-center rounded-2xl transition",
            active
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          );

          const fullRowBtn = cn(
            "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium transition",
            active
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          );

          const iconClass = cn(
            "h-5 w-5 transition",
            active ? "text-white" : "text-slate-400 group-hover:text-slate-600"
          );

          const chevronClass = cn(
            "ml-auto h-4 w-4 transition",
            active
              ? "text-white/90"
              : "text-slate-400 group-hover:text-slate-600",
            showChildren ? "rotate-180" : "rotate-0"
          );

          // --- COLLAPSED (icon-only) ---
          if (collapsed) {
            // No nested UI in collapsed mode (clean + usable)
            if (hasChildren) {
              return (
                <li key={item.title} className="flex justify-center">
                  <button
                    type="button"
                    className={iconOnlyBtn}
                    title={item.title}
                    aria-label={item.title}
                    // Optional: open first child if you want in collapsed
                    onClick={() => {
                      const first = item.items?.[0]?.url;
                      if (first) window.location.href = first;
                    }}
                  >
                    {Icon ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <span className="h-5 w-5" />
                    )}
                  </button>
                </li>
              );
            }

            return (
              <li key={item.title} className="flex justify-center">
                <Link
                  href={item.url}
                  className={iconOnlyBtn}
                  title={item.title}
                  aria-label={item.title}
                >
                  {Icon ? (
                    <Icon className="h-5 w-5" />
                  ) : (
                    <span className="h-5 w-5" />
                  )}
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
                  {Icon ? <Icon className={iconClass} /> : null}
                  <span className="truncate">{item.title}</span>
                  <ChevronDown className={chevronClass} />
                </button>
              ) : (
                <Link href={item.url} className={fullRowBtn}>
                  {Icon ? <Icon className={iconClass} /> : null}
                  <span className="truncate">{item.title}</span>
                </Link>
              )}

              {showChildren ? (
                <div className="mt-2 space-y-1 pl-12">
                  {item.items!.map((sub) => {
                    const subActive =
                      pathname === sub.url ||
                      pathname.startsWith(sub.url + "/");
                    return (
                      <Link
                        key={sub.title}
                        href={sub.url}
                        className={cn(
                          "block rounded-xl px-3 py-2 text-sm transition",
                          subActive
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {sub.title}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
