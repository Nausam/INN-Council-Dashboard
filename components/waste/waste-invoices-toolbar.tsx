/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import {
  generateWasteInvoicesForMonth,
  markWasteInvoicesOverdue,
} from "@/lib/billing/waste.actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { Check, ChevronsUpDown, History } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  "ALL",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "WAIVED",
  "CANCELLED",
] as const;

function cn(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

export default function WasteInvoicesToolbar({
  initialMonth,
  initialStatus,
  initialCustomerId,
  customers,
}: {
  initialMonth: string;
  initialStatus: string;
  initialCustomerId: string;
  customers: any[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [month, setMonth] = React.useState(initialMonth);
  const [status, setStatus] = React.useState(initialStatus);
  const [customerId, setCustomerId] = React.useState(initialCustomerId);

  const [openCustomer, setOpenCustomer] = React.useState(false);
  const [busy, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  const selectedCustomer = React.useMemo(
    () => customers.find((c) => c.$id === customerId) ?? null,
    [customers, customerId]
  );

  function applyFilters(next?: {
    month?: string;
    status?: string;
    customerId?: string;
  }) {
    const p = new URLSearchParams(sp?.toString() ?? "");

    const nextMonth = next?.month ?? month;
    const nextStatus = next?.status ?? status;
    const nextCustomerId = next?.customerId ?? customerId;

    p.set("month", nextMonth);
    p.set("status", nextStatus);

    if (nextCustomerId) p.set("customerId", nextCustomerId);
    else p.delete("customerId");

    router.push(`/wasteManagement/invoices?${p.toString()}`);
  }

  async function onGenerate(scope: "ALL" | "SELECTED") {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await generateWasteInvoicesForMonth({
          periodMonth: month,
          dueInDays: 10,
          customerId:
            scope === "SELECTED" ? customerId || undefined : undefined,
        });

        setMsg(
          scope === "SELECTED"
            ? `Generated for selected customer • Created ${r.createdCount} • Skipped ${r.skippedCount}`
            : `Generated for month • Created ${r.createdCount} • Skipped ${r.skippedCount}`
        );

        router.refresh();
      } catch (e: any) {
        setMsg(e?.message ?? "Failed to generate invoices.");
      }
    });
  }

  async function onMarkOverdue() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await markWasteInvoicesOverdue();
        setMsg(`Marked overdue: ${r.updated} invoice(s)`);
        router.refresh();
      } catch (e: any) {
        setMsg(e?.message ?? "Failed to mark overdue invoices.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Filters */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_220px_1fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All" : s.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Customer</Label>
          <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-full justify-between">
                <span
                  className={cn(
                    !selectedCustomer ? "text-muted-foreground" : ""
                  )}
                >
                  {selectedCustomer
                    ? `${selectedCustomer.fullName}${
                        selectedCustomer.idCardNumber
                          ? ` • ${selectedCustomer.idCardNumber}`
                          : ""
                      }`
                    : "All customers"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Search customer..." />
                <CommandEmpty>No customer found.</CommandEmpty>

                <CommandGroup className="max-h-[320px] overflow-auto">
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setCustomerId("");
                      setOpenCustomer(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        customerId ? "opacity-0" : "opacity-100"
                      )}
                    />
                    <span>All customers</span>
                  </CommandItem>

                  {customers.map((c) => {
                    const value = `${c.fullName} ${c.idCardNumber ?? ""} ${
                      c.contactNumber ?? ""
                    }`.toLowerCase();
                    return (
                      <CommandItem
                        key={c.$id}
                        value={value}
                        onSelect={() => {
                          setCustomerId(c.$id);
                          setOpenCustomer(false);
                        }}
                        className="flex items-start gap-2"
                      >
                        <Check
                          className={cn(
                            "mt-1 h-4 w-4",
                            customerId === c.$id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {c.fullName}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.idCardNumber ? `ID: ${c.idCardNumber}` : ""}
                            {c.contactNumber ? ` • ${c.contactNumber}` : ""}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          {customerId ? (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">Filtered</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCustomerId("")}
                className="-ml-2 h-7 px-2"
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end lg:justify-start">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => applyFilters({ month, status, customerId })}
            disabled={busy}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Row 2: Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onMarkOverdue} disabled={busy}>
            {busy ? "Working..." : "Mark overdue"}
          </Button>

          <Separator orientation="vertical" className="hidden h-8 sm:block" />

          <Button onClick={() => onGenerate("ALL")} disabled={busy}>
            {busy ? "Generating..." : "Generate month"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => onGenerate("SELECTED")}
            disabled={busy || !customerId}
            title={!customerId ? "Select a customer first" : ""}
          >
            Generate selected
          </Button>
        </div>

        <Button
          asChild
          variant="ghost"
          className="justify-start sm:justify-end"
        >
          <Link
            href="/wasteManagement/payments/history"
            className="inline-flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Payment history
          </Link>
        </Button>
      </div>

      {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
    </div>
  );
}
