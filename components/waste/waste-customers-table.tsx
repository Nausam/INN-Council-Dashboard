/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { upsertWasteSubscription } from "@/lib/billing/waste.actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  customer: {
    $id: string;
    fullName: string;
    idCardNumber?: string;
    address: string;
    contactNumber: string;
    category: string;
  };
  subscription: null | {
    $id: string;
    feeMvr: number;
    frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
    status: "ACTIVE" | "PAUSED";
    startMonth: string;
    endMonth?: string | null;
  };
};

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function freqLabel(f: "MONTHLY" | "QUARTERLY" | "YEARLY") {
  if (f === "MONTHLY") return "Monthly";
  if (f === "QUARTERLY") return "Quarterly";
  return "Yearly";
}

// ✅ NEW: derive default fee from category string (extract first number like 150, 75 etc)
function defaultFeeFromCategory(category?: string): number | null {
  if (!category) return null;
  const m = category.match(/(\d{1,4})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export default function WasteCustomersTable({
  initialRows,
}: {
  initialRows: Row[];
}) {
  const router = useRouter();

  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>(initialRows);

  React.useEffect(() => {
    const s = q.trim().toLowerCase();
    if (!s) return setRows(initialRows);

    setRows(
      initialRows.filter((r) => {
        const c = r.customer;
        return (
          c.fullName.toLowerCase().includes(s) ||
          (c.idCardNumber ?? "").toLowerCase().includes(s) ||
          c.contactNumber.toLowerCase().includes(s) ||
          c.address.toLowerCase().includes(s)
        );
      })
    );
  }, [q, initialRows]);

  const [open, setOpen] = React.useState(false);
  const [activeRow, setActiveRow] = React.useState<Row | null>(null);

  const [feeMvr, setFeeMvr] = React.useState<string>("");
  const [frequency, setFrequency] = React.useState<
    "MONTHLY" | "QUARTERLY" | "YEARLY"
  >("MONTHLY");
  const [startMonth, setStartMonth] = React.useState<string>(ymNow());

  // ✅ NEW: endMonth to satisfy required schema (default: far future)
  const [endMonth, setEndMonth] = React.useState<string>("9999-12");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openDialog(row: Row) {
    setActiveRow(row);
    setError(null);

    const derivedFee = defaultFeeFromCategory(row.customer.category);

    // ✅ Prefill defaults:
    // - subscription fee if exists
    // - else category-derived default if exists
    // - else empty
    setFeeMvr(String(row.subscription?.feeMvr ?? derivedFee ?? ""));

    // - subscription frequency else monthly
    setFrequency(row.subscription?.frequency ?? "MONTHLY");

    // - subscription startMonth else current month
    setStartMonth(row.subscription?.startMonth ?? ymNow());

    // ✅ endMonth: subscription endMonth else 9999-12
    setEndMonth(row.subscription?.endMonth ?? "9999-12");

    setOpen(true);
  }

  async function onSave() {
    if (!activeRow) return;

    const fee = Number(feeMvr);
    if (!Number.isFinite(fee) || fee <= 0) {
      setError("Fee must be a positive number.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertWasteSubscription({
        customerId: activeRow.customer.$id,
        feeMvr: Math.round(fee),
        frequency,
        startMonth,
        endMonth, // ✅ important (schema required in your earlier error)
      } as any);

      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, ID card, phone, address..."
          className="h-10 max-w-md"
        />
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{rows.length}</span>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[260px]">Customer</TableHead>
                <TableHead className="min-w-[260px]">Address</TableHead>
                <TableHead className="w-[140px]">Contact</TableHead>
                <TableHead className="w-[160px]">Category</TableHead>
                <TableHead className="w-[260px]">Waste Fee</TableHead>
                <TableHead className="w-[140px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((r) => {
                const sub = r.subscription;
                const derivedFee = defaultFeeFromCategory(r.customer.category);

                // ✅ Effective values for display
                const effectiveFee = sub ? sub.feeMvr : derivedFee ?? 0;
                const effectiveFreq = sub ? sub.frequency : "MONTHLY";
                const showDefaultHint = !sub && !!derivedFee;

                return (
                  <TableRow key={r.customer.$id}>
                    <TableCell className="align-top">
                      <div className="font-medium leading-5">
                        {r.customer.fullName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        ID: {r.customer.idCardNumber ?? "-"}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="text-sm leading-5">
                        {r.customer.address}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="text-sm">{r.customer.contactNumber}</div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge variant="secondary">{r.customer.category}</Badge>
                    </TableCell>

                    {/* ✅ (3) UPDATED HERE: show derived default fee if no subscription */}
                    <TableCell className="align-top">
                      {effectiveFee > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              sub ? "font-semibold" : "bg-muted text-foreground"
                            }
                          >
                            MVR {effectiveFee}
                          </Badge>

                          <Badge variant="outline">
                            {freqLabel(effectiveFreq)}
                          </Badge>

                          {sub?.status === "PAUSED" ? (
                            <Badge variant="destructive">Paused</Badge>
                          ) : null}

                          {showDefaultHint ? (
                            <span className="text-xs text-muted-foreground">
                              Default from category
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Not set</Badge>
                          <span className="text-xs text-muted-foreground">
                            No subscription
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button variant="outline" onClick={() => openDialog(r)}>
                        {sub ? "Edit fee" : "Set fee"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ✅ (4) UPDATED HERE: dialog prefill + endMonth input */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Set waste fee</DialogTitle>
            <DialogDescription>
              This controls how invoices will be generated for this customer.
            </DialogDescription>
          </DialogHeader>

          {activeRow ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="font-medium">{activeRow.customer.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {activeRow.customer.address}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fee (MVR)</Label>
                  <Input
                    value={feeMvr}
                    onChange={(e) => setFeeMvr(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 150"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(v: any) => setFrequency(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Start month (YYYY-MM)</Label>
                  <Input
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    placeholder="2026-01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Invoices won’t be generated for months before this.
                  </p>
                </div>

                {/* ✅ optional but recommended since your schema required it */}
                <div className="space-y-2 sm:col-span-2">
                  <Label>End month (YYYY-MM)</Label>
                  <Input
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    placeholder="9999-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave as 9999-12 if there is no end date.
                  </p>
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
