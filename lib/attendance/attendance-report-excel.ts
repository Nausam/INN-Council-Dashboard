import type { Borders, Cell, Fill, Worksheet } from "exceljs";

import {
  ABSENT_LABEL,
  DHIVEHI_WEEKDAYS,
  EMPLOYEES_PER_PAGE,
  leaveCellText,
  monthTitleDv,
  type AttendanceReport,
  type AttendanceReportEmployee,
} from "@/lib/attendance/attendance-report-shared";

const DV_FONT = "Faruma";
const HEADER_ROWS = 3;
const OFF_DAY_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
const THIN_BORDER: Partial<Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function styleCell(cell: Cell, font: Partial<Cell["font"]>, wrap = true) {
  cell.font = { size: 12, ...font };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: wrap, readingOrder: "rtl" };
  cell.border = THIN_BORDER;
}

function joinedDateValue(iso: string): Date | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * One sheet laid out like the paper register: right-to-left, a day-number and
 * weekday column, then up to seven employees, repeated for each printed page.
 */
function addGroupSheet(
  ws: Worksheet,
  report: AttendanceReport,
  employees: AttendanceReportEmployee[],
) {
  const title = monthTitleDv(report.month);
  const pages: AttendanceReportEmployee[][] = [];
  for (let i = 0; i < employees.length; i += EMPLOYEES_PER_PAGE) {
    pages.push(employees.slice(i, i + EMPLOYEES_PER_PAGE));
  }

  const lineCounts = report.days.map(() => 1);
  let column = 1;

  for (const page of pages) {
    const dayNumberCol = column;
    const weekdayCol = column + 1;
    ws.getColumn(dayNumberCol).width = 5.5;
    ws.getColumn(weekdayCol).width = 10;
    ws.mergeCells(1, dayNumberCol, HEADER_ROWS, weekdayCol);
    const titleCell = ws.getCell(1, dayNumberCol);
    titleCell.value = title;
    styleCell(titleCell, { name: DV_FONT, size: 16, bold: true });

    report.days.forEach((day, index) => {
      const row = HEADER_ROWS + 1 + index;
      const weekday = ws.getCell(row, weekdayCol);
      weekday.value = DHIVEHI_WEEKDAYS[day.weekday];
      styleCell(weekday, { name: DV_FONT });
      const number = ws.getCell(row, dayNumberCol);
      number.value = day.day;
      styleCell(number, { name: "Calibri" });
      if (day.off) {
        weekday.fill = OFF_DAY_FILL;
        number.fill = OFF_DAY_FILL;
      }
    });

    page.forEach((employee, offset) => {
      const col = weekdayCol + 1 + offset;
      ws.getColumn(col).width = 15;

      const name = ws.getCell(1, col);
      name.value = employee.nameDv;
      styleCell(name, { name: DV_FONT });
      const designation = ws.getCell(2, col);
      designation.value = employee.designationDv;
      styleCell(designation, { name: DV_FONT, bold: true });
      const joined = ws.getCell(3, col);
      joined.value = joinedDateValue(employee.joinedDate);
      joined.numFmt = "dd-mmm-yy";
      styleCell(joined, { name: "Calibri" }, false);

      report.days.forEach((day, index) => {
        const cell = ws.getCell(HEADER_ROWS + 1 + index, col);
        const entry = employee.cells[day.day];
        const lines = [
          ...(entry?.leave ? [leaveCellText(entry.leave)] : []),
          ...(entry?.time ? [entry.time] : []),
          ...(entry?.mark === "present" ? ["✓"] : []),
          ...(entry?.mark === "absent" ? [ABSENT_LABEL] : []),
        ];
        cell.value = lines.join("\n");
        styleCell(cell, {
          name: entry?.leave || entry?.mark === "absent" ? DV_FONT : "Calibri",
          size: 11,
        });
        if (day.off) cell.fill = OFF_DAY_FILL;
        lineCounts[index] = Math.max(lineCounts[index], lines.length);
      });
    });

    column = weekdayCol + 1 + page.length;
  }

  ws.getRow(1).height = 43;
  ws.getRow(2).height = 42;
  ws.getRow(3).height = 17.25;
  lineCounts.forEach((lines, index) => {
    ws.getRow(HEADER_ROWS + 1 + index).height = Math.max(25.5, lines * 15);
  });
}

export async function buildAttendanceReportWorkbook(report: AttendanceReport): Promise<Blob> {
  // The browser bundle is CommonJS, so the classes may sit on `default`.
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  for (const group of report.groups) {
    if (group.employees.length === 0) continue;
    const pages = Math.ceil(group.employees.length / EMPLOYEES_PER_PAGE);
    const ws = workbook.addWorksheet(group.title, {
      views: [{ rightToLeft: true }],
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: pages,
        fitToHeight: 1,
        margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    });
    addGroupSheet(ws, report, group.employees);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
