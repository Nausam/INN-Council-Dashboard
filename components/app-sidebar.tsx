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

// Sample data (yours)
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
        { title: "Prayer Times", url: "/attendance/mosque/prayerTimes" },
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
    <Sidebar collapsible="icon" {...props} className="bg-white">
      <SidebarHeader className="border-b border-slate-100">
        <div
          className={collapsed ? "flex justify-center p-2" : "px-5 pt-6 pb-4"}
        >
          <div className={collapsed ? "w-11" : ""}>
            <TeamSwitcher teams={data.teams} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3">
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-100 bg-white">
        <div className={collapsed ? "flex justify-center p-2" : "p-3"}>
          <div className={collapsed ? "w-11" : "w-full"}>
            <NavUser user={data.user} />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
