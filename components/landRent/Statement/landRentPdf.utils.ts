/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  LAND_RENT_STAMP_MARGIN_MM,
  loadLandRentStamp,
  stampLandRentPdfPages,
} from "@/lib/landrent/landRent.pdfStamp";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const prevHtmlClass = document.documentElement.className;
  const prevTransform = el.style.transform;
  const prevOrigin = el.style.transformOrigin;

  document.documentElement.classList.add("pdf-export");
  el.style.transformOrigin = "top left";
  el.style.transform = "none";

  try {
    const stamp = await loadLandRentStamp();
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
    pdf.save(
      filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`
    );
  } finally {
    el.style.transform = prevTransform;
    el.style.transformOrigin = prevOrigin;
    document.documentElement.className = prevHtmlClass;
  }
}
