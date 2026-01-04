"use client";

import { Button } from "@/components/ui/button";
import { applyWasteDefaultsForAllCustomers } from "@/lib/billing/waste.actions";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function ApplyWasteDefaultsButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await applyWasteDefaultsForAllCustomers({
              frequency: "MONTHLY",
              endMonth: "9999-12",
            });
            setMsg(
              `Applied defaults: ${r.created} created • ${r.skipped} skipped`
            );
            router.refresh();
          });
        }}
      >
        {pending ? "Applying..." : "Apply defaults"}
      </Button>

      {msg ? (
        <span className="text-xs text-muted-foreground">{msg}</span>
      ) : null}
    </div>
  );
}
