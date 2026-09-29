export const dynamic = "force-dynamic";

import {
  fetchEmployeeById,
  fetchEmployeeLeaveCalendar,
} from "@/lib/firebase/hr";
import { EmployeeLeaveCalendarView } from "../../../[id]/leaves/EmployeeLeaveCalendarView";

export default async function EmployeeProfileLeaveCalendarPage({ params }: { params: { id: string } }) {
  const [employee, leaves] = await Promise.all([
    fetchEmployeeById(params.id).catch(() => null),
    fetchEmployeeLeaveCalendar(params.id),
  ]);
  return <EmployeeLeaveCalendarView employee={employee} leaves={leaves} />;
}
