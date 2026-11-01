import { readFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  isSalaamKind,
  SALAAM_FAMILY_LEAVE_TYPES,
  type LeaveDayDetails,
  type SalaamFamilyLeaveType,
} from "@/lib/leave/salaam-family-types";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "assets",
  "forms",
  "salaam-family-leave-template.docx",
);

const SLOT = {
  dayOne: {
    date: "0EF231EA",
    reportedTime: "2A8583A1",
    reason: "62C63A6E",
    supervisorDate: "1F6AD246",
    supervisorTime: "1ED20C56",
  },
  dayTwo: {
    date: "219A49F4",
    reportedTime: "11C8DF84",
    reason: "7CA4AC9B",
    supervisorDate: "7C2E4F9A",
    supervisorTime: "75A67999",
  },
  dayOneLeaveType: "49EFD948",
  additionalDate: "1BB695AA",
  additionalTime: "5EBB85E9",
  additionalReason: "60F397B7",
  additionalLeaveType: "1B971810",
  employeeName: "6983EDA3",
  address: "4040720C",
  designation: "0FDC208B",
  supervisorName: "549BC8B3",
  supervisorDesignation: "082B36E4",
  supervisorSection: "60446D31",
  supervisorSignature: "62BF3007",
  acceptorName: "058027C0",
  acceptorSignature: "3118CA4A",
  acceptorDesignation: "278EE1DE",
  acceptedDate: "2D765E51",
  acceptedTime: "5F14A4A0",
} as const;

function escapeXml(value: string): string {
  return value
    // XML forbids these control characters; removing them is intentional.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `halfPoints` is the font size in half points: 20 is the form's usual 10pt. */
function fillBlankParagraph(xml: string, paraId: string, value: string, halfPoints = 20): string {
  const marker = `w14:paraId="${paraId}"`;
  const start = xml.indexOf(marker);
  if (start < 0) throw new Error(`Leave template slot ${paraId} is missing`);
  const paragraphStart = xml.lastIndexOf("<w:p ", start);
  const paragraphEnd = xml.indexOf("</w:p>", start);
  if (paragraphStart < 0 || paragraphEnd < 0) {
    throw new Error(`Leave template slot ${paraId} is malformed`);
  }
  const paragraph = xml.slice(paragraphStart, paragraphEnd);
  if (/<w:t(?:\s|>)/.test(paragraph)) {
    throw new Error(`Leave template slot ${paraId} is no longer blank`);
  }
  const run = `<w:r><w:rPr><w:rFonts w:ascii="Faruma" w:hAnsi="Faruma" w:cs="Faruma"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/><w:rtl/><w:lang w:bidi="dv-MV"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
  return xml.slice(0, paragraphEnd) + run + xml.slice(paragraphEnd);
}

function replaceParagraphText(xml: string, paraId: string, value: string): string {
  const marker = `w14:paraId="${paraId}"`;
  const start = xml.indexOf(marker);
  if (start < 0) throw new Error(`Leave template slot ${paraId} is missing`);
  const paragraphStart = xml.lastIndexOf("<w:p ", start);
  const paragraphEnd = xml.indexOf("</w:p>", start);
  if (paragraphStart < 0 || paragraphEnd < 0) {
    throw new Error(`Leave template slot ${paraId} is malformed`);
  }
  const paragraph = xml.slice(paragraphStart, paragraphEnd);
  const matches = paragraph.match(/<w:t(?:\s[^>]*)?>.*?<\/w:t>/g);
  if (matches?.length !== 1) {
    throw new Error(`Leave template slot ${paraId} must contain one value`);
  }
  const updated = paragraph.replace(matches[0], `<w:t>${escapeXml(value)}</w:t>`);
  return xml.slice(0, paragraphStart) + updated + xml.slice(paragraphEnd);
}

function replaceTextInParagraph(xml: string, paraId: string, previous: string, value: string): string {
  const marker = `w14:paraId="${paraId}"`;
  const start = xml.indexOf(marker);
  if (start < 0) throw new Error(`Leave template slot ${paraId} is missing`);
  const paragraphStart = xml.lastIndexOf("<w:p ", start);
  const paragraphEnd = xml.indexOf("</w:p>", start);
  if (paragraphStart < 0 || paragraphEnd < 0) {
    throw new Error(`Leave template slot ${paraId} is malformed`);
  }
  const paragraph = xml.slice(paragraphStart, paragraphEnd);
  const original = `<w:t>${escapeXml(previous)}</w:t>`;
  if (!paragraph.includes(original)) {
    throw new Error(`Leave template slot ${paraId} has changed`);
  }
  const updated = paragraph.replace(original, `<w:t>${escapeXml(value)}</w:t>`);
  return xml.slice(0, paragraphStart) + updated + xml.slice(paragraphEnd);
}

const EMU_PER_INCH = 914_400;

/**
 * Where a signature goes and how large it may be drawn, in inches. `baseline`
 * is how far below the top of its paragraph the bottom of the signature sits.
 */
const SIGNATURES = {
  // A box about 1.1 x 0.5 inches.
  supervisor: { slot: SLOT.supervisorSignature, maxWidth: 1.0, maxHeight: 0.62, baseline: 0.2, docPrId: 100 },
  // A short row (about 1.5 x 0.28 inches) under the designation, so it sits
  // low and small enough to stay clear of the designation.
  acceptor: { slot: SLOT.acceptorSignature, maxWidth: 1.3, maxHeight: 0.32, baseline: 0.27, docPrId: 102 },
} as const;

function pngSize(png: Uint8Array): { width: number; height: number } {
  const isPng = png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
  if (!isPng || png.length < 24) throw new Error("Signature must be a PNG");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * Floats a signature over its box, centred and resting near the box's bottom.
 * It may reach a little above the box, as a pen signature would, without
 * moving the layout.
 */
function addSignature(
  files: Record<string, Uint8Array>,
  xml: string,
  who: keyof typeof SIGNATURES,
  png: Uint8Array,
): string {
  const { slot, maxWidth, maxHeight, baseline, docPrId } = SIGNATURES[who];
  const media = `media/${who}-signature.png`;
  const relId = `rId${who}Signature`;
  const { width, height } = pngSize(png);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const cx = Math.round(width * scale * EMU_PER_INCH);
  const cy = Math.round(height * scale * EMU_PER_INCH);
  const offset = Math.round(baseline * EMU_PER_INCH) - cy;

  const marker = `w14:paraId="${slot}"`;
  const start = xml.indexOf(marker);
  if (start < 0) throw new Error(`Leave template slot ${slot} is missing`);
  const paragraphStart = xml.lastIndexOf("<w:p ", start);
  const paragraphEnd = xml.indexOf("</w:p>", start);
  if (paragraphStart < 0 || paragraphEnd < 0) throw new Error(`Leave template slot ${slot} is malformed`);
  if (/<w:(?:t|drawing)(?:\s|>)/.test(xml.slice(paragraphStart, paragraphEnd))) {
    throw new Error(`Leave template slot ${slot} is no longer blank`);
  }
  const run =
    `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251660288 + docPrId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${offset}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${docPrId}" name="${who} signature"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId + 1}" name="${who}-signature.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;

  files[`word/${media}`] = png;
  const rels = strFromU8(files["word/_rels/document.xml.rels"]);
  files["word/_rels/document.xml.rels"] = strToU8(rels.replace(
    "</Relationships>",
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${media}"/></Relationships>`,
  ));
  const types = strFromU8(files["[Content_Types].xml"]);
  if (!types.includes('Extension="png"')) {
    files["[Content_Types].xml"] = strToU8(types.replace(
      "<Default ",
      '<Default Extension="png" ContentType="image/png"/><Default ',
    ));
  }
  return xml.slice(0, paragraphEnd) + run + xml.slice(paragraphEnd);
}

function reasonWithLeaveType(leaveType: SalaamFamilyLeaveType, reason: string): string {
  const label = SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === leaveType)?.labelDv;
  return `${label} - ${reason}`;
}

export async function fillSalaamFamilyLeaveTemplate(values: {
  leaveType: SalaamFamilyLeaveType;
  date?: string;
  time: string;
  reason: string;
  secondDay?: LeaveDayDetails;
  additionalDetails?: LeaveDayDetails;
  employeeNameDv: string;
  addressDv: string;
  designationDv: string;
  supervisor?: {
    nameDv: string;
    designationDv: string;
    sectionDv: string;
    reportedDate: string;
    /** The supervisor's signature as a PNG, placed in their signature box. */
    signaturePng?: Uint8Array;
  };
  acceptor?: {
    nameDv: string;
    designationDv: string;
    acceptedDate: string;
    acceptedTime: string;
    /** The receiving employee's signature as a PNG, if one is on file. */
    signaturePng?: Uint8Array;
  };
}): Promise<Buffer> {
  const template = await readFile(TEMPLATE_PATH);
  const files = unzipSync(new Uint8Array(template));
  const documentXml = files["word/document.xml"];
  if (!documentXml) throw new Error("Leave template document is missing");

  let xml = strFromU8(documentXml);
  const leaveLabel = SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === values.leaveType)?.labelDv;
  if (!leaveLabel) throw new Error("Invalid leave type");
  if (values.additionalDetails) {
    xml = fillBlankParagraph(xml, SLOT.additionalDate, values.additionalDetails.date);
    xml = fillBlankParagraph(xml, SLOT.additionalTime, values.additionalDetails.time);
    xml = fillBlankParagraph(xml, SLOT.additionalReason, reasonWithLeaveType(values.leaveType, values.additionalDetails.reason));
    if (isSalaamKind(values.leaveType)) {
      xml = replaceParagraphText(xml, SLOT.additionalLeaveType, "ސަލާމުގެ ޗުއްޓީއަށް");
    }
  } else if (values.secondDay) {
    xml = fillBlankParagraph(xml, SLOT.dayTwo.date, values.secondDay.date);
    xml = fillBlankParagraph(xml, SLOT.dayTwo.reportedTime, values.secondDay.time);
    xml = fillBlankParagraph(xml, SLOT.dayTwo.reason, reasonWithLeaveType(values.leaveType, values.secondDay.reason));
  } else {
    if (!values.date) throw new Error("Day 1 leave date is missing");
    xml = replaceTextInParagraph(xml, SLOT.dayOneLeaveType, "(ސަލާމް)", `(${leaveLabel})`);
    xml = fillBlankParagraph(xml, SLOT.dayOne.date, values.date);
    xml = fillBlankParagraph(xml, SLOT.dayOne.reportedTime, values.time);
    xml = fillBlankParagraph(xml, SLOT.dayOne.reason, reasonWithLeaveType(values.leaveType, values.reason));
  }
  xml = fillBlankParagraph(xml, SLOT.employeeName, values.employeeNameDv);
  xml = fillBlankParagraph(xml, SLOT.address, values.addressDv);
  xml = fillBlankParagraph(xml, SLOT.designation, values.designationDv);
  if (values.supervisor) {
    // The supervisor's time is the time the employee reported that day.
    if (values.secondDay && !values.additionalDetails) {
      xml = fillBlankParagraph(xml, SLOT.dayTwo.supervisorDate, values.supervisor.reportedDate);
      xml = fillBlankParagraph(xml, SLOT.dayTwo.supervisorTime, values.secondDay.time);
    } else if (!values.additionalDetails) {
      xml = fillBlankParagraph(xml, SLOT.dayOne.supervisorDate, values.supervisor.reportedDate);
      xml = fillBlankParagraph(xml, SLOT.dayOne.supervisorTime, values.time);
    }
    xml = fillBlankParagraph(xml, SLOT.supervisorName, values.supervisor.nameDv);
    xml = replaceParagraphText(xml, SLOT.supervisorDesignation, values.supervisor.designationDv);
    xml = fillBlankParagraph(xml, SLOT.supervisorSection, values.supervisor.sectionDv);
    if (values.supervisor.signaturePng) {
      xml = addSignature(files, xml, "supervisor", values.supervisor.signaturePng);
    }
  }
  if (values.acceptor) {
    xml = fillBlankParagraph(xml, SLOT.acceptorName, values.acceptor.nameDv);
    // A narrow cell; a slightly smaller size keeps most designations on one line.
    xml = fillBlankParagraph(xml, SLOT.acceptorDesignation, values.acceptor.designationDv, 17);
    xml = fillBlankParagraph(xml, SLOT.acceptedDate, values.acceptor.acceptedDate);
    xml = fillBlankParagraph(xml, SLOT.acceptedTime, values.acceptor.acceptedTime);
    if (values.acceptor.signaturePng) {
      xml = addSignature(files, xml, "acceptor", values.acceptor.signaturePng);
    }
  }
  files["word/document.xml"] = strToU8(xml);
  return Buffer.from(zipSync(files, { level: 6 }));
}
