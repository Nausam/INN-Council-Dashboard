import { resolveSectionForLateness } from "@/lib/attendance/council-lateness";

function normalizeSectionKey(section?: string): string {
  return (section ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

/** Councillors and WDC use ID Card No; other staff use Record Card No. */
export function recordCardLabelForEmployee(
  section?: string,
  designation?: string,
): string {
  const councillorOrWdcKeys = [
    "councillor",
    "councilor",
    "council",
    "counciler",
    "wdc",
  ];

  const sectionKey = normalizeSectionKey(section);
  if (councillorOrWdcKeys.includes(sectionKey)) {
    return "ID Card No";
  }

  const resolvedKey = normalizeSectionKey(
    resolveSectionForLateness(section, designation),
  );
  if (councillorOrWdcKeys.includes(resolvedKey)) {
    return "ID Card No";
  }

  return "Record Card No";
}
