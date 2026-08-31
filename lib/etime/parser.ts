import * as cheerio from "cheerio";

export type ParsedEtimeRow = {
  sourceRecordId: string;
  employeeCode: string;
  departmentId: string;
  timestampText: string;
  ignored: boolean;
  ignoredReason: string | null;
};

export type ParsedEtimeSnapshot = {
  rows: ParsedEtimeRow[];
  responseDate: string;
  complete: boolean;
  parserErrors: string[];
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function cleanCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** TeamOffice often embeds sortable stamp + display: 2026073004150030/07/2026 04:15 */
export function extractTeamOfficePunchDateTime(raw: string): string | null {
  const text = cleanCellText(raw);
  const display = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
  if (display) return `${display[1]} ${display[2]}`;

  const compact = text.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (compact) {
    return `${compact[3]}/${compact[2]}/${compact[1]} ${compact[4]}:${compact[5]}:${compact[6]}`;
  }

  if (/\d{2}\/\d{2}\/\d{4}/.test(text)) return text;
  return null;
}

function looksIgnored(statusRaw: string, ignoreRaw: string): boolean {
  const status = statusRaw.toLowerCase();
  const ignore = ignoreRaw.toLowerCase();
  return (
    ignore.includes("ignore") ||
    ignore === "i" ||
    ignore === "yes" ||
    ignore === "true" ||
    status.includes("ignore") ||
    status === "i"
  );
}

export function parseEtimeHtmlSnapshot(
  html: string,
  expectedDate: string,
): ParsedEtimeSnapshot {
  const parserErrors: string[] = [];
  const $ = cheerio.load(html);

  const table =
    $("#employee_master_tbl").first().length > 0
      ? $("#employee_master_tbl").first()
      : $("table").first();

  if (!table.length) {
    return {
      rows: [],
      responseDate: expectedDate,
      complete: false,
      parserErrors: ["No table found in eTime response."],
    };
  }

  const headers = table
    .find("thead tr")
    .first()
    .find("th,td")
    .map((_, el) => cleanCellText($(el).text()))
    .get();

  // Fallback if thead missing
  const headerRow =
    headers.length > 0
      ? headers
      : table
          .find("tr")
          .first()
          .find("th,td")
          .map((_, el) => cleanCellText($(el).text()))
          .get();

  const employeeIdx = findColumnIndex(headerRow, ["empcode", "employee", "emp"]);
  const dateIdx = findColumnIndex(headerRow, ["punch date", "date"]);
  const recordIdx = findColumnIndex(headerRow, ["record"]);
  const statusIdx = findColumnIndex(headerRow, ["punchusestatus", "status", "use"]);
  const ignoreIdx = findColumnIndex(headerRow, ["ignore"]);

  // TeamOffice RowData: EmpCode + Punch Date is enough (no separate time column).
  if (employeeIdx < 0 || dateIdx < 0) {
    parserErrors.push(
      `Missing required columns. Found headers: ${headerRow.join(", ") || "(none)"}`,
    );
    return {
      rows: [],
      responseDate: expectedDate,
      complete: false,
      parserErrors,
    };
  }

  const rows: ParsedEtimeRow[] = [];
  let coversExpectedDate = false;

  table.find("tbody tr").each((rowIndex, rowEl) => {
    const cells = $(rowEl)
      .find("td")
      .map((_, el) => cleanCellText($(el).text()))
      .get();
    if (cells.length === 0) return;

    const employeeCode = (cells[employeeIdx] ?? "").trim();
    const punchRaw = cells[dateIdx] ?? "";
    const timestampText = extractTeamOfficePunchDateTime(punchRaw);
    if (!employeeCode || !timestampText) return;

    const displayDate = timestampText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (displayDate) {
      const iso = `${displayDate[3]}-${displayDate[2]}-${displayDate[1]}`;
      if (iso === expectedDate) coversExpectedDate = true;
    }

    const statusRaw = statusIdx >= 0 ? (cells[statusIdx] ?? "") : "";
    const ignoreRaw = ignoreIdx >= 0 ? (cells[ignoreIdx] ?? "") : "";
    const ignored = looksIgnored(statusRaw, ignoreRaw);
    const recordId =
      (recordIdx >= 0 ? cells[recordIdx] : "")?.trim() ||
      `${expectedDate}:${employeeCode}:${timestampText}:${rowIndex}`;

    rows.push({
      sourceRecordId: recordId,
      employeeCode,
      departmentId: "",
      timestampText,
      ignored,
      ignoredReason: ignored ? ignoreRaw || statusRaw || "ignored" : null,
    });
  });

  // Some pages put rows directly under table without tbody
  if (rows.length === 0) {
    table.find("tr").slice(1).each((rowIndex, rowEl) => {
      const cells = $(rowEl)
        .find("td")
        .map((_, el) => cleanCellText($(el).text()))
        .get();
      if (cells.length === 0) return;
      const employeeCode = (cells[employeeIdx] ?? "").trim();
      const timestampText = extractTeamOfficePunchDateTime(cells[dateIdx] ?? "");
      if (!employeeCode || !timestampText) return;
      rows.push({
        sourceRecordId: `${expectedDate}:${employeeCode}:${timestampText}:${rowIndex}`,
        employeeCode,
        departmentId: "",
        timestampText,
        ignored: false,
        ignoredReason: null,
      });
      coversExpectedDate = true;
    });
  }

  return {
    rows,
    responseDate: expectedDate,
    complete: parserErrors.length === 0 && (coversExpectedDate || rows.length > 0),
    parserErrors,
  };
}

export function parseEtimeTimestamp(
  timestampText: string,
  fallbackDate: string,
): string | null {
  const trimmed = timestampText.trim();
  if (!trimmed) return null;

  const dmY = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (dmY) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = dmY;
    const isoLocal = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:00`;
    const parsed = new Date(isoLocal);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const isoCandidate = trimmed.includes("T")
    ? trimmed
    : `${trimmed.replace(" ", "T")}:00+05:00`;
  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const withDate = `${fallbackDate}T${trimmed}:00+05:00`;
  const fallbackParsed = new Date(withDate);
  if (!Number.isNaN(fallbackParsed.getTime())) return fallbackParsed.toISOString();

  return null;
}
