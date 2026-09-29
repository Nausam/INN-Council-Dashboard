import { readFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
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
  acceptorName: "058027C0",
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

function fillBlankParagraph(xml: string, paraId: string, value: string): string {
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
  const run = `<w:r><w:rPr><w:rFonts w:ascii="Faruma" w:hAnsi="Faruma" w:cs="Faruma"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:rtl/><w:lang w:bidi="dv-MV"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
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
    reportedTime: string;
  };
  acceptor?: {
    nameDv: string;
    designationDv: string;
    acceptedDate: string;
    acceptedTime: string;
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
    if (values.leaveType === "salaam") {
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
    if (values.secondDay && !values.additionalDetails) {
      xml = fillBlankParagraph(xml, SLOT.dayTwo.supervisorDate, values.supervisor.reportedDate);
      xml = fillBlankParagraph(xml, SLOT.dayTwo.supervisorTime, values.supervisor.reportedTime);
    } else if (!values.additionalDetails) {
      xml = fillBlankParagraph(xml, SLOT.dayOne.supervisorDate, values.supervisor.reportedDate);
      xml = fillBlankParagraph(xml, SLOT.dayOne.supervisorTime, values.supervisor.reportedTime);
    }
    xml = fillBlankParagraph(xml, SLOT.supervisorName, values.supervisor.nameDv);
    xml = replaceParagraphText(xml, SLOT.supervisorDesignation, values.supervisor.designationDv);
    xml = fillBlankParagraph(xml, SLOT.supervisorSection, values.supervisor.sectionDv);
  }
  if (values.acceptor) {
    xml = fillBlankParagraph(xml, SLOT.acceptorName, values.acceptor.nameDv);
    xml = fillBlankParagraph(xml, SLOT.acceptorDesignation, values.acceptor.designationDv);
    xml = fillBlankParagraph(xml, SLOT.acceptedDate, values.acceptor.acceptedDate);
    xml = fillBlankParagraph(xml, SLOT.acceptedTime, values.acceptor.acceptedTime);
  }
  files["word/document.xml"] = strToU8(xml);
  return Buffer.from(zipSync(files, { level: 6 }));
}
