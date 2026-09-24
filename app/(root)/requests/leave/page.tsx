export const dynamic = "force-dynamic";

import { FamilyLeaveRequestsPanel } from "@/components/admin/FamilyLeaveRequestsPanel";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { redirect } from "next/navigation";

export default async function LeaveRequestPage() {
  const profile = await getSessionAuthProfile();
  if (!profile?.isAdmin) redirect("/employees/details");
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <FamilyLeaveRequestsPanel />
    </main>
  );
}
