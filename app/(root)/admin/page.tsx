export const dynamic = "force-dynamic";

import { fetchLeaveRequests, fetchOvertimeRequests } from "@/lib/actions/hr.actions";
import { AdminPageView } from "./AdminPageView";

export default async function AdminPage() {
  const [initialLeave, initialOvertime] = await Promise.all([
    fetchLeaveRequests(4, 0),
    fetchOvertimeRequests(4, 0),
  ]);
  return (
    <AdminPageView
      initialLeave={initialLeave}
      initialOvertime={initialOvertime}
    />
  );
}
