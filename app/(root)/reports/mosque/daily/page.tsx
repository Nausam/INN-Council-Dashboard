export const dynamic = "force-dynamic";

import {
  fetchAllEmployees,
  fetchMosqueAssistants,
} from "@/lib/actions/hr.actions";
import { MosqueDailyReportsView } from "./MosqueDailyReportsView";

export default async function MosqueDailyReportsPage() {
  const [initialAssistants, initialEmployees] = await Promise.all([
    fetchMosqueAssistants(),
    fetchAllEmployees(),
  ]);
  return (
    <MosqueDailyReportsView
      initialAssistants={initialAssistants}
      initialEmployees={initialEmployees}
    />
  );
}
