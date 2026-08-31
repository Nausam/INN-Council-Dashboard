export const dynamic = "force-dynamic";

import { EmployeesPageView } from "@/components/employees/EmployeesPageView";
import { fetchSlimEmployees } from "@/lib/firebase/hr";

export default async function EmployeesPage() {
  const employees = await fetchSlimEmployees();
  return <EmployeesPageView employees={employees} />;
}
