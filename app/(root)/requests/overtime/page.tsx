"use client";

import { PageHeader, PageShell } from "@/components/design-system";
import { OvertimeRequestForm } from "@/components/overtime/OvertimeRequestForm";
import { Clock } from "lucide-react";

export default function OvertimeRequestPage() {
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
