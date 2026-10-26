export const dynamic = "force-dynamic";

import { MissingLeaveFormsPanel } from "@/components/admin/MissingLeaveFormsPanel";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { redirect } from "next/navigation";

export default async function MissingLeaveFormsPage() {
  const profile = await getSessionAuthProfile();
  if (!profile?.isAdmin) redirect("/employees/details");
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12"><MissingLeaveFormsPanel /></main>;
}
