"use client";

import LandRentNoticeLetter, { type LandRentNoticeLetterData } from "@/components/landRent/Notices/LandRentNoticeLetter";
import { elementToPdfBytes, withPdfExportMode } from "@/components/landRent/Statement/landRentPdf.utils";
import { loadLandRentStamp } from "@/lib/landrent/landRent.pdfStamp";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

type NoticeForPdf = LandRentNoticeLetterData & { noticeNumber: string };

async function waitForImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
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

function fileName(notice: NoticeForPdf, taken: Set<string>) {
  const label = (notice.agreementNumber || notice.landName || notice.leaseId)
    .replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const base = `${notice.noticeNumber} - ${label}`;
  let name = `${base}.pdf`;
  for (let n = 2; taken.has(name); n += 1) name = `${base} (${n}).pdf`;
  taken.add(name);
  return name;
}

/**
 * Renders notices off-screen as stamped A4 PDFs and downloads them: one PDF
 * for a single notice, otherwise one zip. Returns how many were saved.
 */
export async function downloadLandNoticePdfs(
  notices: NoticeForPdf[],
  options: { onProgress?: (done: number) => void; isCancelled?: () => boolean } = {},
): Promise<{ saved: number; failed: string[] }> {
  if (notices.length === 0) return { saved: 0, failed: [] };

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-10000px", top: "0", width: "1200px", pointerEvents: "none" });
  document.body.appendChild(host);
  const root = createRoot(host);

  const files: Record<string, Uint8Array> = {};
  const names = new Set<string>();
  const failed: string[] = [];

  try {
    await withPdfExportMode(async () => {
      const stamp = await loadLandRentStamp();
      for (let index = 0; index < notices.length; index += 1) {
        if (options.isCancelled?.()) break;
        const notice = notices[index];
        try {
          flushSync(() => root.render(<div><LandRentNoticeLetter notice={notice} /></div>));
          await waitForImages(host);
          const target = host.firstElementChild?.firstElementChild as HTMLElement;
          files[fileName(notice, names)] = await elementToPdfBytes(target, stamp);
        } catch (error) {
          failed.push(`${notice.noticeNumber}: ${error instanceof Error ? error.message : "Could not create PDF"}`);
        }
        options.onProgress?.(index + 1);
      }
    });
  } finally {
    root.unmount();
    host.remove();
  }

  const entries = Object.entries(files);
  if (entries.length === 1) {
    const [name, bytes] = entries[0];
    saveBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), name);
  } else if (entries.length > 1) {
    // PDFs are already compressed, so store them without recompressing.
    const { zipSync } = await import("fflate");
    const zipped = zipSync(files, { level: 0 });
    const today = new Date().toISOString().slice(0, 10);
    saveBlob(new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `land-rent-notices-${today}.zip`);
  }
  return { saved: entries.length, failed };
}
