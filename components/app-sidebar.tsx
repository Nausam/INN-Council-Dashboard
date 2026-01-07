"use client";

import {
  AudioWaveform,
  Boxes,
  Calendar,
  Command,
  FileText,
  GalleryVerticalEnd,
  Home,
  Package,
  Users,
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
} from "@/components/ui/sidebar";

// This is sample data.
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
      isActive: true,
      items: [
        {
          title: "Home",
          url: "/",
        },
        {
          title: "Admin",
          url: "/admin",
        },
      ],
    },
    {
      title: "Employees",
      url: "#",
      icon: Users,
      isActive: true,
      items: [
        {
          title: "All Employees",
          url: "/employees",
        },
        {
          title: "Add Employee",
          url: "/employees/add",
        },
      ],
    },
    {
      title: "Attendance",
      url: "#",
      icon: Calendar,
      isActive: true,
      items: [
        {
          title: "Council",
          url: "/attendance/council",
        },
        {
          title: "Mosque",
          url: "/attendance/mosque",
        },
        {
          title: "Prayer Times",
          url: "/attendance/mosque/prayerTimes",
        },
      ],
    },
    {
      title: "Requests",
      url: "#",
      icon: Calendar,
      isActive: true,
      items: [
        {
          title: "Leave",
          url: "/requests/leave",
        },
        {
          title: "Overtime",
          url: "/requests/overtime",
        },
      ],
    },
    {
      title: "Reports",
      url: "#",
      icon: FileText,
      isActive: true,
      items: [
        {
          title: "Council Report",
          url: "/reports/council",
        },
        {
          title: "Mosque Daily Report",
          url: "/reports/mosque/daily",
        },
        {
          title: "Mosque Monthly Report",
          url: "/reports/mosque/monthly",
        },
      ],
    },
    {
      title: "Stock",
      url: "#",
      icon: Package,
      isActive: true,
      items: [
        {
          title: "General",
          url: "#",
        },
      ],
    },
    {
      title: "Inventory",
      url: "#",
      icon: Boxes,
      isActive: true,
      items: [
        {
          title: "General",
          url: "#",
        },
      ],
    },
    {
      title: "Waste Management",
      url: "#",
      icon: Boxes,
      isActive: true,
      items: [
        {
          title: "Customers",
          url: "/wasteManagement/customers",
        },
        {
          title: "Invoices",
          url: "/wasteManagement/invoices",
        },
        {
          title: "Payments",
          url: "/wasteManagement/payments",
        },
        {
          title: "Payment History",
          url: "/wasteManagement/payments/history",
        },
      ],
    },
    {
      title: "Land Rent",
      url: "#",
      icon: Boxes,
      isActive: true,
      items: [
        {
          title: "Rent Details",
          url: "/landRent/details",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
