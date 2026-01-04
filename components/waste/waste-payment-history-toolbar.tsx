"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METHODS = ["ALL", "CASH", "TRANSFER", "CHEQUE", "OTHER"] as const;

export default function WastePaymentHistoryToolbar({
  initialMonth,
  initialQ,
  initialMethod,
}: {
  initialMonth: string;
  initialQ: string;
  initialMethod: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [month, setMonth] = React.useState(initialMonth);
  const [q, setQ] = React.useState(initialQ);
  const [method, setMethod] = React.useState(initialMethod);

  function apply(next: { month?: string; q?: string; method?: string }) {
    const p = new URLSearchParams(sp?.toString() ?? "");
    if (next.month !== undefined) p.set("month", next.month);
    if (next.q !== undefined) p.set("q", next.q);
    if (next.method !== undefined) p.set("method", next.method);
    router.push(`/wasteManagement/payments/history?${p.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="h-10 w-[180px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select
            value={method}
            onValueChange={(v) => {
              setMethod(v);
              apply({ method: v, month, q });
            }}
          >
            <SelectTrigger className="h-10 w-[220px]">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "ALL" ? "All methods" : m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Search</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name / ID / reference..."
            className="h-10 w-full sm:w-[260px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply({ month, method, q });
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => apply({ month, method, q })}>
          Apply
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            setMethod("ALL");
            apply({ q: "", method: "ALL" });
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
