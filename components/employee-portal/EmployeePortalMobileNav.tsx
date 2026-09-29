import { Banknote, Clock3, FileText, LayoutGrid, WalletCards } from "lucide-react";
import Link from "next/link";
import styles from "./EmployeePortalMobileNav.module.css";

type PortalSection = "overview" | "attendance" | "leave" | "pay" | "requests";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "attendance", label: "Attend", icon: Clock3 },
  { id: "leave", label: "Leave", icon: WalletCards },
  { id: "pay", label: "Pay", icon: Banknote },
  { id: "requests", label: "Requests", icon: FileText },
] as const;

export function EmployeePortalMobileNav({
  employeeId,
  active,
}: {
  employeeId: string;
  active: PortalSection;
}) {
  return (
    <nav className={styles.mobileNav} aria-label="Employee profile sections">
      {sections.map(({ id, label, icon: Icon }) => {
        const content = <><Icon aria-hidden="true" /><span>{label}</span></>;
        return id === active ? (
          <span key={id} className={styles.active} aria-current="page">
            {content}
          </span>
        ) : (
          <Link key={id} href={`/employees/details/${employeeId}?tab=${id}`}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
