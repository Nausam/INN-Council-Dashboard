import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CouncilCard } from "@/components/design-system";

type SkeletonAttendanceTableProps = {
  variant?: "council" | "mosque";
  rows?: number;
};

const SkeletonAttendanceTable = ({
  variant = "council",
  rows = 12,
}: SkeletonAttendanceTableProps) => {
  const mosqueCols = variant === "mosque";

  return (
    <CouncilCard interactive="none" className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="w-12 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              #
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Employee
            </TableHead>
            {mosqueCols ? (
              <>
                {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((label) => (
                  <TableHead
                    key={label}
                    className="w-[132px] min-w-[132px] px-2 py-3 text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    {label}
                  </TableHead>
                ))}
              </>
            ) : (
              <>
                <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sign in
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </TableHead>
              </>
            )}
            {mosqueCols ? (
              <TableHead className="w-[140px] px-2 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Status
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="px-4 py-3">
                <div className="h-4 w-5 animate-pulse rounded bg-slate-200" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                  </div>
                </div>
              </TableCell>
              {mosqueCols ? (
                Array.from({ length: 5 }).map((__, col) => (
                  <TableCell key={col} className="px-2 py-3">
                    <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
                  </TableCell>
                ))
              ) : (
                <>
                  <TableCell className="px-4 py-3">
                    <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
                  </TableCell>
                </>
              )}
              {mosqueCols ? (
                <TableCell className="px-2 py-3">
                  <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CouncilCard>
  );
};

export default SkeletonAttendanceTable;
