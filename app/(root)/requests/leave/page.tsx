export const dynamic = "force-dynamic";

import { fetchUserLeaveRequests } from "@/lib/actions/hr.actions";
import { LeaveRequestPageView } from "./LeaveRequestPageView";

export default async function LeaveRequestPage() {
  const initialData = await fetchUserLeaveRequests("", 3, 0);
  return <LeaveRequestPageView initialData={initialData} />;
}
