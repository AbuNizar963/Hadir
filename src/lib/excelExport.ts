import * as XLSX from "xlsx-js-style";

export type ExcelCell = string | number | boolean | null | undefined;
type BorderStyle = "thin" | "medium" | "thick";
const thinBorder = { style: "thin" as BorderStyle, color: { rgb: "C9D2DC" } };
const outerBorder = { style: "medium" as BorderStyle, color: { rgb: "7B8794" } };

function textLength(value: ExcelCell): number {
  return String(value ?? "").split("\n").reduce((max, part) => Math.max(max, part.length), 0);
}

export function styleExcelTable(ws: XLSX.WorkSheet, rowStart: number, rowEnd: number, colStart: number, colEnd: number, headerRow: number, serialColumn?: number) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = colStart; c <= colEnd; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = ws[address];
      if (!cell) continue;
      const isHeader = r === headerRow;
      const isSerial = serialColumn !== undefined && c === serialColumn;
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), name: "Arial", sz: isHeader ? 11 : 10, bold: isHeader || isSerial, color: { rgb: isHeader ? "FFFFFF" : "243447" } },
        alignment: { ...(cell.s?.alignment || {}), vertical: "center", horizontal: "center", readingOrder: 2, wrapText: true },
        border: { top: r === rowStart ? outerBorder : thinBorder, bottom: r === rowEnd ? outerBorder : thinBorder, left: c === colStart ? outerBorder : thinBorder, right: c === colEnd ? outerBorder : thinBorder },
        fill: isHeader ? { fgColor: { rgb: "245B7A" } } : { fgColor: { rgb: r % 2 === 0 ? "F7FAFC" : "FFFFFF" } },
      };
    }
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: Math.min(range.s.r, rowStart), c: Math.min(range.s.c, colStart) }, e: { r: Math.max(range.e.r, rowEnd), c: Math.max(range.e.c, colEnd) } });
}

export function styleReportWorkbook(ws: XLSX.WorkSheet, statusColumn?: number, firstDataRow = 4, lastDataRow?: number): void {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const end = lastDataRow ?? range.e.r;
  const title = ws["A1"];
  if (title) {
    title.s = { ...(title.s || {}), font: { name: "Arial", sz: 16, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "173F5F" } }, alignment: { horizontal: "center", vertical: "center", readingOrder: 2 }, border: { bottom: outerBorder } };
  }
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
    if (cell) cell.s = { ...(cell.s || {}), font: { name: "Arial", sz: 10, bold: true, color: { rgb: "334E68" } }, fill: { fgColor: { rgb: "EAF2F8" } }, alignment: { horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true } };
  }
  if (statusColumn === undefined) return;
  for (let r = firstDataRow; r <= end; r += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: statusColumn })];
    if (!cell) continue;
    const value = String(cell.v ?? "");
    let fill = "FFFFFF";
    let font = "243447";
    if (value === "مكتمل") { fill = "DFF5E3"; font = "176B35"; }
    else if (value === "غياب") { fill = "FDE2E1"; font = "A61B1B"; }
    else if (value.includes("بدون انصراف")) { fill = "FFF0CC"; font = "8A5A00"; }
    else if (value.includes("راحة") || value.includes("إجازة")) { fill = "E8EEF7"; font = "365486"; }
    else if (value.includes("حاضر")) { fill = "E0F2FE"; font = "075985"; }
    cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), name: "Arial", bold: true, color: { rgb: font } }, fill: { fgColor: { rgb: fill } }, alignment: { horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true } };
  }
}

export function setExcelRtl(wb: XLSX.WorkBook, ws: XLSX.WorkSheet): void {
  const book = wb as XLSX.WorkBook & { Workbook?: { Views?: Array<{ RTL?: boolean }> } };
  book.Workbook = book.Workbook || {};
  book.Workbook.Views = [{ RTL: true }];
  ws["!rtl"] = true as never;
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (!cell) continue;
      cell.s = { ...(cell.s || {}), alignment: { ...(cell.s?.alignment || {}), horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true } };
    }
  }
}

export function autoFitColumns(ws: XLSX.WorkSheet, rows: ExcelCell[][], min = 12, max = 45) {
  const count = Math.max(0, ...rows.map((row) => row.length));
  ws["!cols"] = Array.from({ length: count }, (_, c) => ({ wch: Math.max(min, Math.min(max, ...rows.map((row) => textLength(row[c]) + 3))) }));
}

export function addSerialColumn(rows: ExcelCell[][], title = "م") { return [[title, ...rows[0]], ...rows.slice(1).map((row, index) => [index + 1, ...row])]; }
export { XLSX };
