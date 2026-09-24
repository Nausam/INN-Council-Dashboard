export const dynamic = "force-dynamic";

import { fetchEmployeeById } from "@/lib/firebase/hr";
import { EmployeeRequestsPageView } from "./EmployeeRequestsPageView";

export default async function EmployeeRequestsPage({
  params,
}: {
  params: { id: string };
}) {
  const employee = await fetchEmployeeById(params.id).catch(() => null);
  return <EmployeeRequestsPageView employee={employee} employeeId={params.id} />;
}
