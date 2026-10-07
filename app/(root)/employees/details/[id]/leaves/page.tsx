import { requireEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { EmployeeLeaveCalendarClient } from "./EmployeeLeaveCalendarClient";

export default async function EmployeeProfileLeaveCalendarPage({ params }: { params: { id: string } }) {
  await requireEmployeeProfileAccess(params.id);
  return <EmployeeLeaveCalendarClient />;
}
