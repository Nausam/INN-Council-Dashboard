"use client";

import * as React from "react";
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
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
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
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
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Home",
          url: "/",
        },
      ],
    },
    {
      title: "Employees",
      url: "#",
      icon: SquareTerminal,
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
      icon: Bot,
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
      title: "Reports",
      url: "#",
      icon: BookOpen,
      isActive: true,
      items: [
        {
          title: "Council Report",
          url: "/reports",
        },
        {
          title: "Mosque Report",
          url: "/reports",
        },
      ],
    },
    {
      title: "Stock",
      url: "#",
      icon: Settings2,
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
      icon: Settings2,
      isActive: true,
      items: [
        {
          title: "General",
          url: "#",
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
