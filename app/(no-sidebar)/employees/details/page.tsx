import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { EMPLOYEE_PROFILE_HOME } from "@/lib/employee-profile-pwa";
import { redirect } from "next/navigation";
import { EmployeeLoginView } from "./EmployeeLoginView";

export const dynamic = "force-dynamic";

export default function EmployeeDetailsLoginPage() {
  // A signed-in employee goes straight to their profile; only Log out asks for the PIN again.
  const employeeId = getEmployeeProfileSessionId();
  if (employeeId) redirect(`${EMPLOYEE_PROFILE_HOME}/${employeeId}`);
  return <EmployeeLoginView />;
}
