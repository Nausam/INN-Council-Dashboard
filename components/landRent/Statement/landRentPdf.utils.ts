/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  LAND_RENT_STAMP_MARGIN_MM,
  loadLandRentStamp,
  stampLandRentPdfPages,
} from "@/lib/landrent/landRent.pdfStamp";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Runs `work` with the page in PDF export mode (smaller type, A4 page width).
 * A batch export wraps all its statements in one call so the page doesn't
 * switch back and forth between statements.
 */
export async function withPdfExportMode<T>(work: () => Promise<T>): Promise<T> {
  const prevHtmlClass = document.documentElement.className;
  document.documentElement.classList.add("pdf-export");
  try {
    return await work();
  } finally {
    document.documentElement.className = prevHtmlClass;
  }
}

/** Captures `el` as a stamped A4 jsPDF document. Call inside withPdfExportMode. */
async function renderStampedPdf(el: HTMLElement, stamp: HTMLImageElement): Promise<any> {
  const prevTransform = el.style.transform;
  const prevOrigin = el.style.transformOrigin;
  el.style.transformOrigin = "top left";
  el.style.transform = "none";

  try {
    // Wait for layout and fonts before capturing the statement.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
      await sleep(50);
    }
    const html2pdf = (await import("html2pdf.js")).default;
    const worker = (html2pdf() as any).from(el).set({
      margin: [0, 0, LAND_RENT_STAMP_MARGIN_MM, 0],
      pagebreak: {
        mode: ["css", "legacy"],
        before: ".pdf-break",
        avoid: [".avoid-break"],
      },
      html2canvas: {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,

        // ✅ Force the clone to use the same RTL + centering rules
        onclone: async (doc: Document) => {
          doc.documentElement.classList.add("pdf-export");
          doc.querySelectorAll("[data-pdf-exclude]").forEach((node) => node.remove());

          // Wait for fonts inside the cloned document too
          if ((doc as any).fonts?.ready) {
            await (doc as any).fonts.ready;
          }

          // Force RTL + centering on common “problem” areas
          doc.querySelectorAll("[data-pdf-center-rtl='1']").forEach((node) => {
            const el = node as HTMLElement;
            el.setAttribute("dir", "rtl");
            el.style.textAlign = "center";
          });
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    });

    const pdf = await worker.toPdf().get("pdf");
    const canvas = await worker.get("canvas");
    const pageSize = await worker.get("pageSize");
    stampLandRentPdfPages(pdf, canvas, pageSize, stamp);
    return pdf;
  } finally {
    el.style.transform = prevTransform;
    el.style.transformOrigin = prevOrigin;
  }
}

export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  await withPdfExportMode(async () => {
    const stamp = await loadLandRentStamp();
    const pdf = await renderStampedPdf(el, stamp);
    pdf.save(
      filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`
    );
  });
}

/** Same stamped PDF as downloadElementAsPdf, returned as bytes. Call inside withPdfExportMode. */
export async function elementToPdfBytes(el: HTMLElement, stamp: HTMLImageElement): Promise<Uint8Array> {
  const pdf = await renderStampedPdf(el, stamp);
  return new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
}
