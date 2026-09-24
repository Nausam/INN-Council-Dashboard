export const dynamic = "force-dynamic";

import { fetchAllEmployees } from "@/lib/actions/hr.actions";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { redirect } from "next/navigation";
import { UploadSalarySlipView } from "./UploadSalarySlipView";

export default async function UploadSalarySlipPage() {
  const profile = await getSessionAuthProfile();
  if (!profile?.isAdmin) redirect("/");
  const initialEmployees = await fetchAllEmployees();
  return <UploadSalarySlipView initialEmployees={initialEmployees} />;
}
