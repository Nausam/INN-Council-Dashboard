/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  listCustomerUnpaidWasteInvoices,
  recordWastePayment,
} from "@/lib/billing/waste.actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

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
import { Check, ChevronsUpDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

type Customer = {
  $id: string;
  fullName: string;
  idCardNumber?: string;
  address?: string;
  contactNumber?: string;
};

function cn(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function statusBadge(status: string) {
  switch (status) {
    case "PAID":
      return <Badge>Paid</Badge>;
    case "PARTIALLY_PAID":
      return <Badge variant="secondary">Partially paid</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">Overdue</Badge>;
    case "ISSUED":
      return <Badge variant="outline">Issued</Badge>;
    case "WAIVED":
      return <Badge variant="secondary">Waived</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WastePaymentsPanel({
  customers,
}: {
  customers: Customer[];
}) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] =
    React.useState<string>("");
  const selectedCustomer = React.useMemo(
    () => customers.find((c) => c.$id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<
    "CASH" | "TRANSFER" | "CHEQUE" | "OTHER"
  >("CASH");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [loadingInvoices, startInvoices] = React.useTransition();
  const [saving, startSave] = React.useTransition();

  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [totalBalance, setTotalBalance] = React.useState<number>(0);

  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [lastPaymentId, setLastPaymentId] = React.useState<string | null>(null);

  function loadInvoices(customerId: string) {
    setErr(null); // keep error reset if you want

    startInvoices(async () => {
      try {
        const r = await listCustomerUnpaidWasteInvoices(customerId);
        setInvoices(r.invoices);
        setTotalBalance(r.totalBalance);
      } catch (e: any) {
        setInvoices([]);
        setTotalBalance(0);
        setErr(e?.message ?? "Failed to load invoices.");
      }
    });
  }

  async function onRecordPayment() {
    setMsg(null);
    setErr(null);

    if (!selectedCustomerId) {
      setErr("Please select a customer.");
      return;
    }

    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      setErr("Payment amount must be greater than 0.");
      return;
    }

    startSave(async () => {
      try {
        const r = await recordWastePayment({
          customerId: selectedCustomerId,
          amountMvr: v,
          method,
          reference,
          notes,
          receivedByUserId: "system",
        });

        setLastPaymentId(r.paymentId);

        setMsg(
          `Payment recorded • Allocated MVR ${r.allocatedTotal} to ${r.allocatedCount} invoice(s) • Unallocated MVR ${r.unallocatedMvr}`
        );

        setAmount("");
        setReference("");
        setNotes("");

        // refresh invoices panel + server-rendered pages
        loadInvoices(selectedCustomerId);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to record payment.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Payment form */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <div className="text-sm font-medium">Record payment</div>
          <div className="text-xs text-muted-foreground">
            Payments are allocated to the oldest unpaid invoices automatically.
          </div>
        </div>

        <div className="space-y-5 p-4 md:p-5">
          {/* Customer select */}
          <div className="space-y-2">
            <Label>Customer</Label>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
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
                      : "Select customer..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search name / ID / phone..." />
                  <CommandEmpty>No customer found.</CommandEmpty>

                  <CommandGroup className="max-h-[320px] overflow-auto">
                    {customers.map((c) => {
                      const value = `${c.fullName} ${c.idCardNumber ?? ""} ${
                        c.contactNumber ?? ""
                      }`.toLowerCase();
                      return (
                        <CommandItem
                          key={c.$id}
                          value={value}
                          onSelect={() => {
                            setSelectedCustomerId(c.$id);
                            setOpen(false);
                            setMsg(null);
                            setLastPaymentId(null);
                            setErr(null);
                            loadInvoices(c.$id);
                          }}
                          className="flex items-start gap-2"
                        >
                          <Check
                            className={cn(
                              "mt-1 h-4 w-4",
                              selectedCustomerId === c.$id
                                ? "opacity-100"
                                : "opacity-0"
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

            {selectedCustomer ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{selectedCustomer.fullName}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedCustomer.address ?? ""}
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount (MVR)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 150"
              />
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Slip no / note"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          {err ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {err}
            </div>
          ) : null}

          {msg ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              {msg}
            </div>
          ) : null}

          {msg && lastPaymentId ? (
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/wasteManagement/payments/${lastPaymentId}`}>
                  View receipt
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={onRecordPayment}
              disabled={saving || !selectedCustomerId}
            >
              {saving ? "Recording..." : "Record payment"}
            </Button>
          </div>
        </div>
      </div>

      {/* Unpaid invoices */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Unpaid invoices</div>
              <div className="text-xs text-muted-foreground">
                For the selected customer
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total balance</div>
              <div className="text-lg font-semibold">MVR {totalBalance}</div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          {!selectedCustomerId ? (
            <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Select a customer to view unpaid invoices.
            </div>
          ) : loadingInvoices ? (
            <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No unpaid invoices 🎉
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.$id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{inv.invoiceNo}</div>
                        {statusBadge(inv.status)}
                        <Badge variant="outline">{inv.periodMonth}</Badge>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Issued: {new Date(inv.issueDate).toLocaleDateString()} •
                        Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Balance
                      </div>
                      <div className="text-base font-semibold">
                        MVR {Number(inv.balanceMvr ?? 0)}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-medium">
                      MVR {Number(inv.totalMvr ?? 0)}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">Paid</div>
                    <div className="font-medium">
                      MVR {Number(inv.paidMvr ?? 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
