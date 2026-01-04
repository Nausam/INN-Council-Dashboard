/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import WasteInvoiceActions from "./waste-invoice-actions";

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

export default function WasteInvoicesTable({ invoices }: { invoices: any[] }) {
  return (
    <div className="p-4 md:p-5">
      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[180px]">Invoice</TableHead>
                <TableHead className="min-w-[260px]">Customer</TableHead>
                <TableHead className="w-[140px]">Period</TableHead>
                <TableHead className="w-[160px]">Status</TableHead>
                <TableHead className="w-[140px] text-right">Total</TableHead>
                <TableHead className="w-[140px] text-right">Paid</TableHead>
                <TableHead className="w-[140px] text-right">Balance</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.$id}>
                  <TableCell className="align-top">
                    <div className="font-medium">{inv.invoiceNo || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="font-medium leading-5">
                      {inv.customerName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {inv.customerAddress}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="text-sm">{inv.periodMonth}</div>
                  </TableCell>

                  <TableCell className="align-top">
                    {statusBadge(inv.status)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    MVR {Number(inv.totalMvr ?? 0)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    MVR {Number(inv.paidMvr ?? 0)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    <span className="font-medium">
                      MVR {Number(inv.balanceMvr ?? 0)}
                    </span>
                  </TableCell>

                  {/* ✅ Replace View button with actions menu */}
                  <TableCell className="text-right">
                    <WasteInvoiceActions
                      inv={{
                        $id: inv.$id,
                        invoiceNo: inv.invoiceNo,
                        periodMonth: inv.periodMonth,
                        customerName: inv.customerName,
                        status: inv.status,
                        totalMvr: Number(inv.totalMvr ?? 0),
                        paidMvr: Number(inv.paidMvr ?? 0),
                        balanceMvr: Number(inv.balanceMvr ?? 0),
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}

              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No invoices found for this filter.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
