import { requireEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import EmployeeSalarySlipsPage from "../../../[id]/salary-slips/page";

export default async function EmployeeProfileSalarySlipsPage({ params }: { params: { id: string } }) {
  await requireEmployeeProfileAccess(params.id);
  return <EmployeeSalarySlipsPage />;
}
