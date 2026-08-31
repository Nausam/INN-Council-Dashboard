export const dynamic = "force-dynamic";

import { fetchAllEmployees } from "@/lib/actions/hr.actions";
import { UploadSalarySlipView } from "./UploadSalarySlipView";

export default async function UploadSalarySlipPage() {
  const initialEmployees = await fetchAllEmployees();
  return <UploadSalarySlipView initialEmployees={initialEmployees} />;
}
