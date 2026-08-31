export const dynamic = "force-dynamic";

import { fetchEmployeeById } from "@/lib/firebase/hr";
import { EmployeeProfileView } from "./EmployeeProfileView";

export default async function EmployeeProfilePage({
  params,
}: {
  params: { id: string };
}) {
  let employee = null;
  try {
    employee = await fetchEmployeeById(params.id);
  } catch {
    employee = null;
  }
  return <EmployeeProfileView employee={employee} />;
}
