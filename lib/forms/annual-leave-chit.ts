import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnnualLeaveRequest } from "@/lib/actions/annual-leave.actions";
import { annualApproverSignaturePath } from "@/lib/leave/approval-signatures";
import { nextWorkingDayAfter } from "@/lib/leave/date-range";

const TEMPLATE = path.join(process.cwd(), "assets", "forms", "annual-leave-chit-template.pdf");
const FONT = path.join(process.cwd(), "public", "fonts", "Faruma.ttf");
const DHIVEHI_MONTHS = [
  "ޖެނުއަރީ", "ފެބްރުއަރީ", "މާރިޗް", "އޭޕްރިލް", "މޭ", "ޖޫން",
  "ޖުލައި", "އޯގަސްޓް", "ސެޕްޓެމްބަރ", "އޮކްޓޯބަރ", "ނޮވެމްބަރ", "ޑިސެމްބަރ",
] as const;

function chitDateParts(value: string): { day: string; month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = DHIVEHI_MONTHS[Number(match[2]) - 1];
  return month ? { day: String(Number(match[3])), month, year: match[1] } : null;
}

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function drawRight(page: PDFPage, font: PDFFont, value: string | number | undefined, right: number, top: number, maxWidth: number, defaultSize = 11) {
  const original = singleLine(String(value ?? ""));
  if (!original) return false;
  let size = defaultSize;
  while (size > 8 && font.widthOfTextAtSize(original, size) > maxWidth) size -= 0.5;
  let visible = original;
  let truncated = false;
  if (font.widthOfTextAtSize(visible, size) > maxWidth) {
    const chars = Array.from(visible);
    while (chars.length && font.widthOfTextAtSize(`${chars.join("")}...`, size) > maxWidth) chars.pop();
    visible = `${chars.join("")}...`;
    truncated = true;
  }
  page.drawText(visible, {
    x: right - font.widthOfTextAtSize(visible, size),
    // Faruma's visible glyphs sit about 5.5 pt below pdf-lib's nominal text top.
    y: page.getHeight() - top - size + 5.5,
    font,
    size,
    color: rgb(0.08, 0.08, 0.08),
  });
  return truncated;
}

function drawChitDate(page: PDFPage, font: PDFFont, value: string, right: number, top: number, maxWidth: number, defaultSize = 11) {
  const parts = chitDateParts(value);
  if (!parts) return drawRight(page, font, value, right, top, maxWidth, defaultSize);
  let size = defaultSize;
  const width = (atSize: number) =>
    font.widthOfTextAtSize(parts.year, atSize) +
    font.widthOfTextAtSize(parts.month, atSize) +
    font.widthOfTextAtSize(parts.day, atSize) +
    font.widthOfTextAtSize("  ", atSize) * 2;
  while (size > 8 && width(size) > maxWidth) size -= 0.5;
  const gap = font.widthOfTextAtSize("  ", size);
  const y = page.getHeight() - top - size + 5.5;
  const xYear = right - width(size);
  const xMonth = xYear + font.widthOfTextAtSize(parts.year, size) + gap;
  const xDay = xMonth + font.widthOfTextAtSize(parts.month, size) + gap;
  const options = { y, font, size, color: rgb(0.08, 0.08, 0.08) };
  page.drawText(parts.year, { ...options, x: xYear });
  page.drawText(parts.month, { ...options, x: xMonth });
  page.drawText(parts.day, { ...options, x: xDay });
  return false;
}

export async function createAnnualLeaveChitPdf(request: AnnualLeaveRequest): Promise<Uint8Array> {
  if (request.approvalStatus !== "Approved" || !request.approver) {
    throw new Error("Annual leave has not been approved");
  }
  const signaturePath = annualApproverSignaturePath(request.approver.employeeId);
  if (!signaturePath) throw new Error("Approver signature is unavailable");

  const pdf = await PDFDocument.load(await readFile(TEMPLATE));
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT), { subset: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error("Annual leave chit template is empty");

  drawRight(page, font, request.employeeNameDv || request.fullName, 450, 201, 175);
  drawRight(page, font, request.addressDv, 160, 201, 135, 10);
  drawRight(page, font, request.permanentAddressDv || request.addressDv, 450, 227, 175, 10);
  drawRight(page, font, request.recordCardNumber, 160, 227, 130);
  drawRight(page, font, request.designationDv, 480, 253, 210);
  drawRight(page, font, request.idCardNumber, 160, 253, 130);

  drawRight(page, font, "އަހަރީ ޗުއްޓީ", 445, 340, 205);
  const longReason = drawRight(page, font, request.reason, 430, 363, 300, 10);
  drawRight(page, font, request.totalDays, 450, 384, 200);
  drawChitDate(page, font, request.startDate, 445, 406, 200);
  drawChitDate(page, font, request.endDate, 440, 429, 200);
  drawChitDate(page, font, nextWorkingDayAfter(request.endDate), 425, 449, 200);

  drawRight(page, font, request.leaveBalance, 455, 525, 180);
  drawRight(page, font, request.familyLeaveBalance, 425, 548, 180);
  if (request.joinedDate) drawChitDate(page, font, request.joinedDate, 425, 570, 190);

  // The supplied example contains a fixed date. Replace it with this approval's date.
  page.drawRectangle({ x: 220, y: page.getHeight() - 669, width: 180, height: 23, color: rgb(1, 1, 1) });
  const approvalDate = (request.approvedAt || request.approver.assignedDate || request.createdAt || "").slice(0, 10);
  if (approvalDate) drawChitDate(page, font, approvalDate, 375, 650, 155, 10);

  const signature = await pdf.embedPng(await readFile(signaturePath));
  const scale = Math.min(125 / signature.width, 60 / signature.height);
  const signatureWidth = signature.width * scale;
  const signatureHeight = signature.height * scale;
  page.drawImage(signature, {
    x: 185 - signatureWidth,
    y: page.getHeight() - 640 - signatureHeight,
    width: signatureWidth,
    height: signatureHeight,
  });
  drawRight(page, font, request.approver.nameDv || request.approver.name, 180, 695, 125, 10);
  drawRight(page, font, request.approver.designationDv, 180, 721, 125, 10);

  if (longReason) {
    const lines: string[] = [];
    let line = "";
    for (const word of singleLine(request.reason).split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 11) <= 495) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of Array.from(word)) {
        if (font.widthOfTextAtSize(`${line}${char}`, 11) > 495 && line) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) lines.push(line);
    let extra: PDFPage | undefined;
    let y = 0;
    for (const text of lines) {
      if (!extra || y < 55) {
        extra = pdf.addPage([page.getWidth(), page.getHeight()]);
        extra.drawText("Annual leave reason (continued)", { x: 48, y: extra.getHeight() - 70, font, size: 15 });
        y = extra.getHeight() - 110;
      }
      drawRight(extra, font, text, 545, extra.getHeight() - y - 11, 495, 11);
      y -= 22;
    }
  }
  return pdf.save();
}
