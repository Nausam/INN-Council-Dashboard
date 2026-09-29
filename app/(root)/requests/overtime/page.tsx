import { PageHeader, PageShell } from "@/components/design-system";
import { OvertimeRequestsPanel } from "@/components/admin/OvertimeRequestsPanel";
import { OvertimeRequestForm } from "@/components/overtime/OvertimeRequestForm";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OvertimeRequestPage() {
  const profile = await getSessionAuthProfile();
  if (profile?.isAdmin) return <OvertimeRequestsPanel />;
  return (
    <PageShell>
      <PageHeader
        icon={Clock}
        title="Overtime Request"
        subtitle="Submit overtime for council staff."
      />
      <OvertimeRequestForm />
    </PageShell>
  );
}
