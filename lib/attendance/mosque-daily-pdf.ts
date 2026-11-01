/** One prayer's cell on the mosque daily report. */
export type MosqueDailyCell = {
  kind: "time" | "late" | "absent" | "leave" | "pending";
  text: string;
  /** Second line, e.g. "+5 min" or "60 min". */
  note: string;
};

export type MosqueDailyPdfRow = {
  date: string;
  day: string;
  cells: MosqueDailyCell[];
  /** Late minutes for the day, or null on a leave day. */
  total: number | null;
};

type Rgb = [number, number, number];

const INK: Rgb = [27, 48, 46];
const MUTED: Rgb = [123, 138, 139];
const LINE: Rgb = [228, 236, 232];
const TEAL: Rgb = [22, 122, 103];
const TONES: Record<MosqueDailyCell["kind"], { fill: Rgb; text: Rgb }> = {
  time: { fill: [236, 250, 244], text: [31, 122, 85] },
  late: { fill: [255, 241, 236], text: [180, 100, 60] },
  absent: { fill: [255, 238, 240], text: [183, 50, 70] },
  leave: { fill: [236, 244, 255], text: [61, 110, 168] },
  pending: { fill: [246, 244, 248], text: [138, 135, 146] },
};

/**
 * A clean A4 landscape PDF of one employee's month: each day's prayer
 * sign-ins, the day's late minutes and the month's grand total.
 */
export async function downloadMosqueDailyPdf(report: {
  employeeName: string;
  designation: string;
  monthLabel: string;
  prayerLabels: string[];
  rows: MosqueDailyPdfRow[];
  grandTotal: number;
  fileName: string;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  const columns = [
    { label: "#", width: 9 },
    { label: "Date", width: 27 },
    { label: "Day", width: 25 },
    ...report.prayerLabels.map((label) => ({ label, width: 33 })),
    { label: "Total", width: 0 },
  ];
  columns[columns.length - 1].width = tableWidth - columns.slice(0, -1).reduce((sum, column) => sum + column.width, 0);
  const rowHeight = 9;
  const headerHeight = 9;

  const text = (value: string, x: number, y: number, options: { size?: number; color?: Rgb; bold?: boolean; align?: "left" | "center" | "right" } = {}) => {
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(options.size ?? 9);
    pdf.setTextColor(...(options.color ?? INK));
    pdf.text(value, x, y, { align: options.align ?? "left" });
  };

  const drawPageHeader = (first: boolean) => {
    if (first) {
      pdf.setFillColor(...TEAL);
      pdf.roundedRect(margin, margin, 3, 16, 1.5, 1.5, "F");
      text("MOSQUE DAILY ATTENDANCE", margin + 7, margin + 4.5, { size: 8, color: TEAL, bold: true });
      text(report.employeeName, margin + 7, margin + 12, { size: 17, bold: true });
      text(`${report.designation ? `${report.designation} · ` : ""}${report.monthLabel}`, margin + 7, margin + 18, { size: 9.5, color: MUTED });
      text("Raa Innamaadhoo Council", pageWidth - margin, margin + 4.5, { size: 8, color: MUTED, align: "right" });
      text(`${report.grandTotal} min`, pageWidth - margin, margin + 13, { size: 17, bold: true, color: [180, 100, 60], align: "right" });
      text("late in this period", pageWidth - margin, margin + 18, { size: 8.5, color: MUTED, align: "right" });
      return margin + 26;
    }
    text(`${report.employeeName} · ${report.monthLabel}`, margin, margin + 4, { size: 9, color: MUTED, bold: true });
    return margin + 8;
  };

  const drawTableHeader = (y: number) => {
    pdf.setFillColor(246, 248, 247);
    pdf.roundedRect(margin, y, tableWidth, headerHeight, 2, 2, "F");
    let x = margin;
    columns.forEach((column, index) => {
      const align = index >= 3 ? "center" : "left";
      const tx = align === "center" ? x + column.width / 2 : x + 3;
      text(column.label.toUpperCase(), tx, y + 5.8, { size: 7, color: MUTED, bold: true, align });
      x += column.width;
    });
    return y + headerHeight + 1;
  };

  let y = drawTableHeader(drawPageHeader(true));
  report.rows.forEach((row, index) => {
    if (y + rowHeight > pageHeight - 13) {
      pdf.addPage();
      y = drawTableHeader(drawPageHeader(false));
    }
    if (index % 2 === 1) {
      pdf.setFillColor(251, 252, 251);
      pdf.rect(margin, y, tableWidth, rowHeight, "F");
    }
    let x = margin;
    text(String(index + 1).padStart(2, "0"), x + 3, y + 5.8, { size: 8, color: MUTED });
    x += columns[0].width;
    text(row.date, x + 3, y + 5.8, { size: 8.5, bold: true });
    x += columns[1].width;
    text(row.day, x + 3, y + 5.8, { size: 8.5, color: MUTED });
    x += columns[2].width;
    row.cells.forEach((cell, cellIndex) => {
      const width = columns[3 + cellIndex].width;
      const tone = TONES[cell.kind];
      pdf.setFillColor(...tone.fill);
      pdf.roundedRect(x + 2, y + 1, width - 4, rowHeight - 2, 1.6, 1.6, "F");
      text(cell.text, x + width / 2, y + (cell.note ? 4.3 : 5.6), { size: 7.4, bold: true, color: tone.text, align: "center" });
      if (cell.note) text(cell.note, x + width / 2, y + 7.3, { size: 6, color: tone.text, align: "center" });
      x += width;
    });
    const totalWidth = columns[columns.length - 1].width;
    text(
      row.total === null ? "Leave" : `${row.total} min`,
      x + totalWidth / 2,
      y + 5.8,
      { size: 9, bold: true, align: "center", color: row.total === null ? TONES.leave.text : row.total > 0 ? TONES.late.text : TONES.time.text },
    );
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  });

  // Grand total under the table.
  if (y + 22 > pageHeight - 10) {
    pdf.addPage();
    y = drawPageHeader(false);
  }
  y += 3;
  pdf.setFillColor(...INK);
  pdf.roundedRect(margin, y, tableWidth, 11, 2.5, 2.5, "F");
  text("Grand total of late minutes", margin + 5, y + 7.1, { size: 9.5, bold: true, color: [255, 255, 255] });
  text(`${report.grandTotal} min`, pageWidth - margin - 5, y + 7.2, { size: 11, bold: true, color: [255, 255, 255], align: "right" });
  text(
    "A prayer not signed in counts as 60 minutes late. Leave days aren't counted.",
    margin,
    y + 17,
    { size: 7.5, color: MUTED },
  );

  const pages = pdf.getNumberOfPages();
  const printed = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    text(`Printed ${printed}`, margin, pageHeight - 7, { size: 7, color: MUTED });
    text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 7, { size: 7, color: MUTED, align: "right" });
  }
  pdf.save(report.fileName);
}
