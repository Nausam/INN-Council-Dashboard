"use client";

import {
  AudioWaveform,
  Calendar,
  Command,
  FileText,
  GalleryVerticalEnd,
  Home,
  MapPinned,
  Package,
  Trash2,
  Users,
  Warehouse,
} from "lucide-react";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "Nausam",
    email: "hussain.nausam@innamaadhoo.gov.mv",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Innamaadhoo Council",
      logo: GalleryVerticalEnd,
      plan: "Dashboard",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: Home,
      items: [
        { title: "Home", url: "/" },
        { title: "Admin", url: "/admin" },
      ],
    },
    {
      title: "Employees",
      url: "#",
      icon: Users,
      items: [
        { title: "All Employees", url: "/employees" },
        { title: "Add Employee", url: "/employees/add" },
      ],
    },
    {
      title: "Attendance",
      url: "#",
      icon: Calendar,
      items: [
        { title: "Council", url: "/attendance/council" },
        { title: "Mosque", url: "/attendance/mosque" },
        {
          title: "Attendance Sheet",
          url: "/attendance/mosque/attendance-sheet",
        },
      ],
    },
    {
      title: "Requests",
      url: "#",
      icon: Calendar,
      items: [
        { title: "Leave", url: "/requests/leave" },
        { title: "Overtime", url: "/requests/overtime" },
      ],
    },
    {
      title: "Reports",
      url: "#",
      icon: FileText,
      items: [
        { title: "Council Report", url: "/reports/council" },
        { title: "Mosque Daily Report", url: "/reports/mosque/daily" },
        { title: "Mosque Monthly Report", url: "/reports/mosque/monthly" },
      ],
    },
    {
      title: "Stock",
      url: "#",
      icon: Package,
      items: [{ title: "General", url: "#" }],
    },
    {
      title: "Inventory",
      url: "#",
      icon: Warehouse,
      items: [{ title: "General", url: "#" }],
    },
    {
      title: "Waste Management",
      url: "#",
      icon: Trash2,
      items: [
        { title: "Customers", url: "/wasteManagement/customers" },
        { title: "Invoices", url: "/wasteManagement/invoices" },
        { title: "Payments", url: "/wasteManagement/payments" },
        { title: "Payment History", url: "/wasteManagement/payments/history" },
      ],
    },
    {
      title: "Land Rent",
      url: "#",
      icon: MapPinned,
      items: [
        { title: "Land Rent Leases", url: "/landRent" },
        { title: "Add Lease", url: "/landRent/new" },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="border-r border-slate-200/50 bg-gradient-to-b from-white to-slate-50/50 transition-all duration-300 ease-out"
      style={{
        willChange: "width",
      }}
    >
      {/* Decorative gradient overlay - no pointer events to avoid interference */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 transition-opacity duration-300"
        style={{
          opacity: collapsed ? 0 : 1,
        }}
      />

      <SidebarHeader className="relative border-b border-slate-200/50">
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            collapsed ? "flex justify-center p-2" : "px-5 pt-6 pb-4"
          )}
        >
          <div
            className="transition-all duration-300 ease-out"
            style={{
              width: collapsed ? "2.75rem" : "100%",
              opacity: collapsed ? 1 : 1,
            }}
          >
            <TeamSwitcher teams={data.teams} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative py-3 overflow-hidden">
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter className="relative border-t border-slate-200/50 bg-gradient-to-b from-transparent to-slate-50/50">
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{
            padding: collapsed ? "0.5rem" : "0.75rem",
          }}
        >
          <div
            className="transition-all duration-300 ease-out"
            style={{
              width: collapsed ? "2.75rem" : "100%",
            }}
          >
            <NavUser user={data.user} />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
