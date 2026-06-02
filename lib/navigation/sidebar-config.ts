import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Calendar,
  FileText,
  Files,
  Home,
  MapPinned,
  Package,
  Trash2,
  Users,
  Warehouse,
} from "lucide-react";

export type SidebarNavChild = {
  title: string;
  url: string;
};

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SidebarNavChild[];
};

export const councilSidebarNav: SidebarNavItem[] = [
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
    title: "Documents",
    url: "#",
    icon: Files,
    items: [{ title: "Document receiver", url: "/document-reciever" }],
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
    title: "Salary",
    url: "#",
    icon: Banknote,
    items: [
      { title: "Salary Slips", url: "/salary-slips" },
      { title: "View Salary Slip", url: "/salary-slips/view" },
      { title: "Upload Slips", url: "/salary-slips/upload" },
    ],
  },
  {
    title: "Attendance",
    url: "#",
    icon: Calendar,
    items: [
      { title: "Council", url: "/attendance/council" },
      { title: "Mosque", url: "/attendance/mosque" },
      { title: "Mosque Sign Sheet", url: "/attendance/mosque/attendance-sheet" },
      { title: "Mosque OT Sheet", url: "/attendance/mosque/ot-sheet" },
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
];
