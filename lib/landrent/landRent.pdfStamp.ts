export const LAND_RENT_STAMP_SRC = "/assets/images/council-stamp.png";
// Leave room on every exported page for the stamp and its surrounding whitespace.
export const LAND_RENT_STAMP_MARGIN_MM = 50;
const STAMP_WIDTH_MM = 35;
const CONTENT_GAP_MM = 8;
const BOTTOM_PADDING_MM = 6;

type StampPdf = {
  internal: {
    getNumberOfPages(): number;
    pageSize: { getWidth(): number; getHeight(): number };
  };
  setPage(page: number): unknown;
  addImage(image: HTMLImageElement, format: string, x: number, y: number, width: number, height: number, alias: string): unknown;
};

export function loadLandRentStamp(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The council stamp could not load. Please try downloading again."));
    image.src = LAND_RENT_STAMP_SRC;
  });
}

/** Place a stamp after each page's visible content, including continuation pages. */
export function stampLandRentPdfPages(
  pdf: StampPdf,
  canvas: HTMLCanvasElement,
  pageSize: { inner: { width: number; ratio: number } },
  stamp: HTMLImageElement,
) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The statement could not be prepared for stamping.");
  // Match html2pdf's slicing exactly, including its rounded pixel page height.
  const sliceHeight = Math.floor(canvas.width * pageSize.inner.ratio);
  const mmPerPixel = pageSize.inner.width / canvas.width;
  const stampHeight = STAMP_WIDTH_MM * stamp.naturalHeight / stamp.naturalWidth;
  const pageCount = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    const start = (page - 1) * sliceHeight;
    const height = Math.min(sliceHeight, canvas.height - start);
    const { data } = context.getImageData(0, start, canvas.width, height);
    let contentBottom = 0;
    // Pagination inserts white space before page breaks. Find the actual bottom
    // of each page's content so short payment pages have the stamp just below it.
    scan: for (let y = height - 1; y >= 0; y -= 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (data[offset + 3] > 0 && Math.min(data[offset], data[offset + 1], data[offset + 2]) < 245) {
          contentBottom = (y + 1) * mmPerPixel;
          break scan;
        }
      }
    }
    pdf.setPage(page);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(
      stamp, "PNG", (pageWidth - STAMP_WIDTH_MM) / 2,
      Math.min(contentBottom + CONTENT_GAP_MM, pageHeight - stampHeight - BOTTOM_PADDING_MM),
      STAMP_WIDTH_MM, stampHeight, "land-rent-council-stamp",
    );
  }
}
