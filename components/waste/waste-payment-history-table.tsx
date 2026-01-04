import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

function methodBadge(method: string) {
  switch (method) {
    case "CASH":
      return <Badge>Cash</Badge>;
    case "TRANSFER":
      return <Badge variant="secondary">Transfer</Badge>;
    case "CHEQUE":
      return <Badge variant="outline">Cheque</Badge>;
    case "OTHER":
      return <Badge variant="outline">Other</Badge>;
    default:
      return <Badge variant="outline">{method}</Badge>;
  }
}

export default function WastePaymentHistoryTable({
  rows,
}: {
  rows: {
    paymentId: string;
    receivedAt: string;
    customerName: string;
    idCardNumber?: string;
    method: string;
    amountMvr: number;
    allocatedMvr: number;
    unallocatedMvr: number;
    reference: string;
  }[];
}) {
  return (
    <div className="p-4 md:p-5">
      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[190px]">Date</TableHead>
                <TableHead className="min-w-[280px]">Customer</TableHead>
                <TableHead className="w-[150px]">Method</TableHead>
                <TableHead className="w-[140px] text-right">Amount</TableHead>
                <TableHead className="w-[140px] text-right">
                  Allocated
                </TableHead>
                <TableHead className="w-[140px] text-right">
                  Unallocated
                </TableHead>
                <TableHead className="min-w-[220px]">Reference</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.paymentId}>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {new Date(r.receivedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {r.paymentId.slice(-8)}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="font-medium" dir="rtl">
                      {r.customerName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.idCardNumber ? `ID card: ${r.idCardNumber}` : ""}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    {methodBadge(r.method)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    MVR {Number(r.amountMvr ?? 0)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    MVR {Number(r.allocatedMvr ?? 0)}
                  </TableCell>

                  <TableCell className="align-top text-right">
                    <span
                      className={r.unallocatedMvr > 0 ? "font-semibold" : ""}
                    >
                      MVR {Number(r.unallocatedMvr ?? 0)}
                    </span>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="truncate text-sm text-muted-foreground">
                      {r.reference || "-"}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/wasteManagement/payments/${r.paymentId}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No payments found for this filter.
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
