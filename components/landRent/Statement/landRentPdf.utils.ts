/* eslint-disable @typescript-eslint/no-explicit-any */
import html2pdf from "html2pdf.js";

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

  // ✅ Wait for layout + fonts
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
    await sleep(50);
  }

  try {
    const worker = (html2pdf() as any).from(el).set({
      margin: 0,
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

    // Allow multi-page, but remove accidental trailing pages (your previous logic)
    const pdf = await worker.toPdf().get("pdf");
    pdf.save(
      filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`
    );
  } finally {
    el.style.transform = prevTransform;
    el.style.transformOrigin = prevOrigin;
    document.documentElement.className = prevHtmlClass;
  }
}
