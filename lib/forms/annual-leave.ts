import { readFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { displayLeaveDate } from "@/lib/leave/date-range";

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "forms", "annual-leave-template.docx");

const SLOT = {
  employeeName: "1480A325",
  recordCard: "534D5633",
  address: "3A260BDE",
  idCard: "470CEDAD",
  designation: "13825BBD",
  submittedDate: "01D3437F",
  leaveType: "35D31BCE",
  reason: "741F28AF",
  duration: "7E1E9A3F",
  startDate: "3E792200",
  endDate: "312F462C",
  takeoverName: "0C6628B1",
  takeoverDesignation: "4BDBA5D5",
  takeoverSection: "016F3B66",
  transferredWork: "7232DF2C",
  takeoverDate: "24A88A41",
  approverName: "0BB97FC6",
  approverDesignation: "55AED3CC",
  approverSection: "25587F53",
  approverDate: "27C82A50",
  collectorName: "48199948",
  collectorDesignation: "1C794858",
  collectedDate: "61E9BA4C",
  leaveBalance: "42842CCB",
} as const;

export type AnnualLeaveFormPerson = {
  employeeId: string;
  name: string;
  nameDv: string;
  designationDv: string;
  sectionDv?: string;
  assignedDate?: string;
};

export type AnnualLeaveFormValues = {
  employeeNameDv: string;
  recordCardNumber?: string;
  addressDv: string;
  idCardNumber?: string;
  designationDv: string;
  submittedDate: string;
  startDate: string;
  endDate: string;
  reason: string;
  totalDays: number;
  leaveBalance?: number;
  takeover: AnnualLeaveFormPerson;
  approver?: AnnualLeaveFormPerson;
  collector?: AnnualLeaveFormPerson;
};

function escapeXml(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addToParagraph(xml: string, paraId: string, value: string, blank = true): string {
  if (!value) return xml;
  const marker = `w14:paraId="${paraId}"`;
  const markerAt = xml.indexOf(marker);
  if (markerAt < 0) throw new Error(`Annual leave template slot ${paraId} is missing`);
  const start = xml.lastIndexOf("<w:p ", markerAt);
  const end = xml.indexOf("</w:p>", markerAt);
  if (start < 0 || end < 0) throw new Error(`Annual leave template slot ${paraId} is malformed`);
  const paragraph = xml.slice(start, end);
  if (blank && /<w:t(?:\s|>)/.test(paragraph)) {
    throw new Error(`Annual leave template slot ${paraId} is no longer blank`);
  }
  const run = `<w:r><w:rPr><w:rFonts w:ascii="Faruma" w:hAnsi="Faruma" w:cs="Faruma"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:rtl/><w:lang w:bidi="dv-MV"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
  return xml.slice(0, end) + run + xml.slice(end);
}

export async function fillAnnualLeaveTemplate(values: AnnualLeaveFormValues): Promise<Buffer> {
  const files = unzipSync(new Uint8Array(await readFile(TEMPLATE_PATH)));
  const document = files["word/document.xml"];
  if (!document) throw new Error("Annual leave template document is missing");
  let xml = strFromU8(document);
  const fields: Array<[string, string]> = [
    [SLOT.employeeName, values.employeeNameDv],
    [SLOT.recordCard, values.recordCardNumber ?? ""],
    [SLOT.address, values.addressDv],
    [SLOT.idCard, values.idCardNumber ?? ""],
    [SLOT.designation, values.designationDv],
    [SLOT.submittedDate, displayLeaveDate(values.submittedDate)],
    [SLOT.leaveType, "އަހަރީ ޗުއްޓީ"],
    [SLOT.reason, values.reason?.trim() && values.reason.trim().toLowerCase() !== "annual leave"
      ? values.reason.trim()
      : "އަހަރީ ޗުއްޓީ"],
    [SLOT.duration, String(values.totalDays)],
    [SLOT.startDate, displayLeaveDate(values.startDate)],
    [SLOT.endDate, displayLeaveDate(values.endDate)],
    [SLOT.takeoverName, values.takeover.nameDv],
    [SLOT.takeoverDesignation, values.takeover.designationDv],
    [SLOT.takeoverSection, values.takeover.sectionDv ?? ""],
    [SLOT.transferredWork, "މުވައްޒަފުގެ މަސައްކަތްތައް"],
    [SLOT.approverName, values.approver?.nameDv ?? ""],
    [SLOT.approverDesignation, values.approver?.designationDv ?? ""],
    [SLOT.approverSection, values.approver?.sectionDv ?? ""],
    [SLOT.collectorName, values.collector?.nameDv ?? ""],
    [SLOT.collectorDesignation, values.collector?.designationDv ?? ""],
    [SLOT.collectedDate, values.collector?.assignedDate ? displayLeaveDate(values.collector.assignedDate) : ""],
    [SLOT.leaveBalance, Number.isFinite(values.leaveBalance) ? String(values.leaveBalance) : ""],
  ];
  for (const [slot, value] of fields) xml = addToParagraph(xml, slot, value);
  xml = addToParagraph(xml, SLOT.takeoverDate, ` ${displayLeaveDate(values.submittedDate)}`, false);
  if (values.approver?.assignedDate) {
    xml = addToParagraph(xml, SLOT.approverDate, ` ${displayLeaveDate(values.approver.assignedDate)}`, false);
  }
  files["word/document.xml"] = strToU8(xml);
  return Buffer.from(zipSync(files, { level: 6 }));
}
