/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  addPenaltyToWasteInvoice,
  cancelWasteInvoice,
  waiveWasteInvoice,
} from "@/lib/billing/waste.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MoreHorizontal } from "lucide-react";

type InvoiceRow = {
  $id: string;
  invoiceNo?: string;
  periodMonth: string;
  customerName?: string;
  status: string;
  totalMvr: number;
  paidMvr: number;
  balanceMvr: number;
};

function MenuButton({
  disabled,
  children,
  onClick,
}: {
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full px-2 py-1.5 text-left text-sm rounded-md",
        "hover:bg-muted focus:outline-none focus:bg-muted",
        "disabled:opacity-50 disabled:pointer-events-none",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function WasteInvoiceActions({ inv }: { inv: InvoiceRow }) {
  const router = useRouter();
  const [busy, start] = React.useTransition();

  const [menuOpen, setMenuOpen] = React.useState(false);

  const [openPenalty, setOpenPenalty] = React.useState(false);
  const [openWaive, setOpenWaive] = React.useState(false);
  const [openCancel, setOpenCancel] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);

  const [penaltyAmount, setPenaltyAmount] = React.useState("");
  const [penaltyReason, setPenaltyReason] = React.useState("");

  const [waiveReason, setWaiveReason] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");

  const canCancel =
    inv.paidMvr <= 0 && !["CANCELLED", "WAIVED"].includes(inv.status);

  const canWaive =
    inv.balanceMvr > 0 && !["PAID", "CANCELLED", "WAIVED"].includes(inv.status);

  const canPenalty = !["CANCELLED", "WAIVED"].includes(inv.status);
  // If you want to also block penalty on PAID invoices, change to:
  // const canPenalty = !["PAID","CANCELLED","WAIVED"].includes(inv.status);

  function closeDialogs() {
    setOpenPenalty(false);
    setOpenWaive(false);
    setOpenCancel(false);
    setErr(null);
  }

  function openDialog(kind: "penalty" | "waive" | "cancel") {
    setErr(null);
    setMenuOpen(false); // ✅ close dropdown first (prevents lock)
    // open dialog next tick to avoid Radix focus clash
    requestAnimationFrame(() => {
      if (kind === "penalty") setOpenPenalty(true);
      if (kind === "waive") setOpenWaive(true);
      if (kind === "cancel") setOpenCancel(true);
    });
  }

  async function onAddPenalty() {
    setErr(null);
    const v = Math.round(Number(penaltyAmount));
    if (!Number.isFinite(v) || v <= 0) {
      setErr("Enter a valid penalty amount.");
      return;
    }

    start(async () => {
      try {
        await addPenaltyToWasteInvoice({
          invoiceId: inv.$id,
          amountMvr: v,
          reason: penaltyReason,
          appliedByUserId: "system",
        });
        closeDialogs();
        setPenaltyAmount("");
        setPenaltyReason("");
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to add penalty.");
      }
    });
  }

  async function onWaive() {
    setErr(null);
    if (!waiveReason.trim()) {
      setErr("Reason is required.");
      return;
    }

    start(async () => {
      try {
        await waiveWasteInvoice({
          invoiceId: inv.$id,
          reason: waiveReason,
          waivedByUserId: "system",
        });
        closeDialogs();
        setWaiveReason("");
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to waive invoice.");
      }
    });
  }

  async function onCancel() {
    setErr(null);
    if (!cancelReason.trim()) {
      setErr("Reason is required.");
      return;
    }

    start(async () => {
      try {
        await cancelWasteInvoice({
          invoiceId: inv.$id,
          reason: cancelReason,
          cancelledByUserId: "system",
        });
        closeDialogs();
        setCancelReason("");
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to cancel invoice.");
      }
    });
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-2">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <MenuButton
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            <Link href={`/wasteManagement/invoices/${inv.$id}`}>View</Link>
          </MenuButton>

          <DropdownMenuSeparator />

          <MenuButton
            disabled={!canPenalty}
            onClick={() => openDialog("penalty")}
          >
            Add penalty
          </MenuButton>

          <MenuButton disabled={!canWaive} onClick={() => openDialog("waive")}>
            Waive
          </MenuButton>

          <MenuButton
            disabled={!canCancel}
            onClick={() => openDialog("cancel")}
          >
            Cancel
          </MenuButton>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add penalty */}
      <Dialog
        open={openPenalty}
        onOpenChange={(v) => {
          setOpenPenalty(v);
          if (!v) closeDialogs();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add penalty</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium">{inv.invoiceNo || "—"}</div>
              <div className="text-xs text-muted-foreground">
                {inv.periodMonth} • Balance: MVR {inv.balanceMvr}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Penalty amount (MVR)</Label>
                <Input
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                />
              </div>

              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Late fee / note"
                />
              </div>
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {err}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs} disabled={busy}>
              Close
            </Button>
            <Button onClick={onAddPenalty} disabled={busy}>
              {busy ? "Saving..." : "Add penalty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive */}
      <Dialog
        open={openWaive}
        onOpenChange={(v) => {
          setOpenWaive(v);
          if (!v) closeDialogs();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Waive invoice</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium">{inv.invoiceNo || "—"}</div>
              <div className="text-xs text-muted-foreground">
                Balance will become MVR 0 • Current balance: MVR{" "}
                {inv.balanceMvr}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Write-off reason..."
              />
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {err}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs} disabled={busy}>
              Close
            </Button>
            <Button onClick={onWaive} disabled={busy || !canWaive}>
              {busy ? "Saving..." : "Waive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog
        open={openCancel}
        onOpenChange={(v) => {
          setOpenCancel(v);
          if (!v) closeDialogs();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel invoice</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium">{inv.invoiceNo || "—"}</div>
              <div className="text-xs text-muted-foreground">
                Only allowed if Paid = 0 • Paid: MVR {inv.paidMvr}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Mistake / duplicate / incorrect customer..."
              />
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {err}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs} disabled={busy}>
              Close
            </Button>
            <Button onClick={onCancel} disabled={busy || !canCancel}>
              {busy ? "Saving..." : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
