import * as XLSX from "xlsx-js-style";

export type ExcelCell = string | number | boolean | null | undefined;

type BorderStyle = "thin" | "medium" | "thick";

const thinBorder = { style: "thin" as BorderStyle, color: { rgb: "B7B7B7" } };
const outerBorder = { style: "thick" as BorderStyle, color: { rgb: "202020" } };

function textLength(value: ExcelCell): number {
  return String(value ?? "").split("\n").reduce((max, part) => Math.max(max, part.length), 0);
}

export function styleExcelTable(
  ws: XLSX.WorkSheet,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
  headerRow: number,
  serialColumn?: number,
) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = colStart; c <= colEnd; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = ws[address];
      if (!cell) continue;
      const isHeader = r === headerRow;
      const isSerial = serialColumn !== undefined && c === serialColumn;
      const border = {
        top: r === rowStart ? outerBorder : thinBorder,
        bottom: r === rowEnd ? outerBorder : thinBorder,
        left: c === colStart ? outerBorder : thinBorder,
        right: c === colEnd ? outerBorder : thinBorder,
      };
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), bold: isHeader || isSerial },
        alignment: { ...(cell.s?.alignment || {}), vertical: "center", horizontal: "right", readingOrder: 2, wrapText: true },
        border,
      };
      if (isHeader) {
        cell.s.fill = { fgColor: { rgb: "E9EEF3" } };
      }
    }
  }

  // Keep Excel's used range intact while ensuring a complete table boundary.
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: Math.min(range.s.r, rowStart), c: Math.min(range.s.c, colStart) },
    e: { r: Math.max(range.e.r, rowEnd), c: Math.max(range.e.c, colEnd) },
  });
}

export function setExcelRtl(wb: XLSX.WorkBook, ws: XLSX.WorkSheet): void {
  // Excel's sheet-view direction is the part that makes column A appear on the right.
  // Cell readingOrder alone only affects text flow, not the worksheet layout.
  const book = wb as XLSX.WorkBook & { Workbook?: { Views?: Array<{ RTL?: boolean }> } };
  book.Workbook = book.Workbook || {};
  book.Workbook.Views = [{ RTL: true }];

  ws["!rtl"] = true as never;
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        alignment: {
          ...(cell.s?.alignment || {}),
          horizontal: "right",
          vertical: "center",
          readingOrder: 2,
          wrapText: true,
        },
      };
    }
  }
}

export function autoFitColumns(ws: XLSX.WorkSheet, rows: ExcelCell[][], min = 12, max = 45) {
  const count = Math.max(0, ...rows.map((row) => row.length));
  ws["!cols"] = Array.from({ length: count }, (_, c) => {
    const width = Math.max(min, Math.min(max, ...rows.map((row) => textLength(row[c]) + 3)));
    return { wch: width };
  });
}

export function addSerialColumn(rows: ExcelCell[][], title = "م") {
  return [
    [title, ...rows[0]],
    ...rows.slice(1).map((row, index) => [index + 1, ...row]),
  ];
}

export { XLSX };
