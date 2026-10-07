"use client";

import type { LandRentOverviewUIRow } from "@/components/landRent/Overview/landRentOverview.utils";
import StatementInvoice from "@/components/landRent/Statement/StatementInvoice";
import { elementToPdfBytes, withPdfExportMode } from "@/components/landRent/Statement/landRentPdf.utils";
import type { StatementDetails } from "@/components/landRent/Statement/useLandRentStatementPage";
import { fetchLatestLandStatementDetails } from "@/lib/landrent/landRent.actions";
import { loadLandRentStamp } from "@/lib/landrent/landRent.pdfStamp";
import { Download, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

type FetchResult = { details: StatementDetails | null } | { error: string };

function fetchLatest(leaseId: string): Promise<FetchResult> {
  // Caught here so a prefetch that fails before it's awaited isn't left unhandled.
  return fetchLatestLandStatementDetails(leaseId)
    .then((details) => ({ details }))
    .catch((error: unknown) => ({ error: error instanceof Error ? error.message : "Could not load statement" }));
}

function leaseLabel(row: LandRentOverviewUIRow): string {
  return row.agreementNumber || row.landName || row.leaseId;
}

/** File-system safe name, unique within the zip. */
function pdfName(row: LandRentOverviewUIRow, monthKey: string, taken: Set<string>): string {
  const base = `${leaseLabel(row)}`.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || row.leaseId;
  let name = `${base} - ${monthKey}.pdf`;
  for (let n = 2; taken.has(name); n += 1) name = `${base} - ${monthKey} (${n}).pdf`;
  taken.add(name);
  return name;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? img.decode().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads the latest statement of every listed lease as one zip of stamped
 * PDFs, rendered the same way as the Download PDF button on a statement.
 */
export default function DownloadAllStatementsButton({
  rows,
  filtered,
  disabled,
}: {
  rows: LandRentOverviewUIRow[];
  /** True when a search narrows the list, so the button says how many. */
  filtered: boolean;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string; details: string[] } | null>(null);
  const cancelled = useRef(false);

  const run = async () => {
    if (progress || rows.length === 0) return;
    cancelled.current = false;
    setResult(null);
    setProgress({ done: 0, total: rows.length });

    // Statements render off-screen in their own React root, then get captured.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, { position: "fixed", left: "-10000px", top: "0", width: "1200px", pointerEvents: "none" });
    document.body.appendChild(host);
    const root = createRoot(host);

    const files: Record<string, Uint8Array> = {};
    const names = new Set<string>();
    const noStatement: string[] = [];
    const failed: string[] = [];

    try {
      await withPdfExportMode(async () => {
        const stamp = await loadLandRentStamp();
        let next = fetchLatest(rows[0].leaseId);
        for (let index = 0; index < rows.length; index += 1) {
          if (cancelled.current) break;
          const row = rows[index];
          const fetched = await next;
          if (index + 1 < rows.length) next = fetchLatest(rows[index + 1].leaseId);

          if ("error" in fetched) {
            failed.push(`${leaseLabel(row)}: ${fetched.error}`);
          } else if (!fetched.details) {
            noStatement.push(leaseLabel(row));
          } else {
            try {
              const details = fetched.details;
              flushSync(() => root.render(<div><StatementInvoice statement={details} /></div>));
              await waitForImages(host);
              const target = host.firstElementChild as HTMLElement;
              files[pdfName(row, details.statement.monthKey, names)] = await elementToPdfBytes(target, stamp);
            } catch (error) {
              failed.push(`${leaseLabel(row)}: ${error instanceof Error ? error.message : "Could not create PDF"}`);
            }
          }
          setProgress({ done: index + 1, total: rows.length });
        }
      });

      const count = Object.keys(files).length;
      if (count > 0) {
        // PDFs are already compressed, so store them without recompressing.
        const { zipSync } = await import("fflate");
        const zipped = zipSync(files, { level: 0 });
        const today = new Date().toISOString().slice(0, 10);
        saveBlob(new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `land-rent-statements-${today}.zip`);
      }

      const details = [
        ...noStatement.map((label) => `${label}: no statement yet`),
        ...failed,
      ];
      const stopped = cancelled.current ? " Stopped early." : "";
      setResult({
        tone: count === 0 ? "error" : details.length ? "warn" : "ok",
        text: count === 0
          ? `No statements were downloaded.${stopped}`
          : `Downloaded ${count} ${count === 1 ? "statement" : "statements"}.${stopped}`,
        details,
      });
    } catch (error) {
      setResult({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not download the statements.",
        details: [],
      });
    } finally {
      root.unmount();
      host.remove();
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const label = filtered ? `Download ${rows.length} statements` : "Download all statements";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || disabled || rows.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:shadow-md disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? `Preparing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : label}
        </button>
        {busy ? (
          <button
            type="button"
            onClick={() => { cancelled.current = true; }}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        ) : null}
      </div>
      {busy ? (
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 transition-all"
            style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
      ) : null}
      {result ? (
        <div
          role={result.tone === "error" ? "alert" : "status"}
          className={`max-w-md rounded-xl px-4 py-3 text-sm ring-1 ${
            result.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
              : result.tone === "warn"
                ? "bg-amber-50 text-amber-900 ring-amber-100"
                : "bg-red-50 text-red-700 ring-red-100"
          }`}
        >
          {result.text}
          {result.details.length ? (
            <ul className="mt-2 list-inside list-disc text-xs">
              {result.details.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
