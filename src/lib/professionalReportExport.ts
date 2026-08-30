import { XLSX, autoFitColumns, styleExcelTable, styleReportWorkbook, setExcelRtl, type ExcelCell } from "@/lib/excelExport";
import { getSettings } from "@/lib/storage";

export type ProfessionalReportMode = "daily" | "monthly" | "annual";
export type ProfessionalReportSummary = {
  employee: { name: string; jobNumber?: string | number | null };
  workDays: number;
  present: number;
  absent: number;
  early: number;
  late: number;
  open: number;
  off: number;
  worked: number;
};
export type ProfessionalReportDay = {
  employee: string;
  jobNumber?: string | number | null;
  date: string;
  day: string;
  status: string;
  checkIn: string;
  checkOut: string;
  worked: string;
  late: number;
  early: number;
  detail: string;
};
export type ProfessionalReportChart = { label: string; value: number };

const border = { style: "thin", color: { rgb: "CBD5E1" } };
const strongBorder = { style: "medium", color: { rgb: "64748B" } };
const darkFill = { fgColor: { rgb: "173F5F" } };
const accentFill = { fgColor: { rgb: "245B7A" } };
const softFill = { fgColor: { rgb: "EAF2F8" } };

function titleStyle(cell: XLSX.CellObject) {
  cell.s = {
    ...(cell.s || {}),
    font: { name: "Arial", sz: 18, bold: true, color: { rgb: "FFFFFF" } },
    fill: darkFill,
    alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
    border: { bottom: strongBorder },
  };
}

function subtitleStyle(cell: XLSX.CellObject) {
  cell.s = {
    ...(cell.s || {}),
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "334E68" } },
    fill: softFill,
    alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
  };
}

function cardStyle(cell: XLSX.CellObject, tone: "neutral" | "success" | "danger" | "warning") {
  const tones = {
    neutral: ["F8FAFC", "243447"],
    success: ["E0F2FE", "075985"],
    danger: ["FDE2E1", "A61B1B"],
    warning: ["FFF0CC", "8A5A00"],
  } as const;
  const [fill, font] = tones[tone];
  cell.s = {
    ...(cell.s || {}),
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: font } },
    fill: { fgColor: { rgb: fill } },
    alignment: { horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true },
    border: { top: strongBorder, bottom: strongBorder, left: strongBorder, right: strongBorder },
  };
}

function setWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function finishSheet(ws: XLSX.WorkSheet, freeze = "A4") {
  ws["!freeze"] = freeze as never;
  ws["!rtl"] = true as never;
  ws["!printHeader"] = [1, 3] as never;
  ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 } as never;
  ws["!margins"] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } as never;
}

function statusTone(value: string): "neutral" | "success" | "danger" | "warning" {
  if (value.includes("غياب")) return "danger";
  if (value.includes("تأخر") || value.includes("مبكر") || value.includes("ناقص")) return "warning";
  if (value.includes("حاضر")) return "success";
  return "neutral";
}

export function downloadProfessionalAttendanceReport(args: {
  mode: ProfessionalReportMode;
  period: string;
  generatedAt: string;
  summaries: ProfessionalReportSummary[];
  dailyRows: ProfessionalReportDay[];
  chartData: ProfessionalReportChart[];
  absenceRows: ProfessionalReportDay[];
}) {
  const { mode, period, generatedAt, summaries, dailyRows, chartData, absenceRows } = args;
  const brandName = String(getSettings().brandName || "HADIR").trim() || "HADIR";
  const total = summaries.reduce((a, s) => ({
    workDays: a.workDays + s.workDays,
    present: a.present + s.present,
    absent: a.absent + s.absent,
    early: a.early + s.early,
    late: a.late + s.late,
    open: a.open + s.open,
    off: a.off + s.off,
    worked: a.worked + s.worked,
  }), { workDays: 0, present: 0, absent: 0, early: 0, late: 0, open: 0, off: 0, worked: 0 });
  const tracked = total.present + total.absent + total.early + total.late + total.open;
  const attendanceRate = tracked ? total.present / tracked : 0;
  const workbook = XLSX.utils.book_new();

  const dashboard = XLSX.utils.aoa_to_sheet([
    [brandName],
    ["الفترة", period, "نوع التقرير", mode === "daily" ? "يومي" : mode === "monthly" ? "شهري" : "سنوي"],
    ["تاريخ إنشاء التقرير", generatedAt, "عدد الموظفين", summaries.length],
    [],
    ["مؤشرات الأداء الرئيسية", "", "", ""],
    ["نسبة الحضور", attendanceRate, "أيام العمل المسجلة", total.workDays],
    ["حاضر", total.present, "غياب", total.absent],
    ["تأخر", total.late, "انصراف مبكر", total.early],
    ["تسجيل ناقص", total.open, "راحة/عطلة", total.off],
    [],
    ["ملاحظة تشغيلية", "هذا الملف يمثل سجل الحضور اليومي للفترة المحددة، مع فصل أيام الغياب والراحة والعطلات."],
  ] as ExcelCell[][]);
  dashboard["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
    { s: { r: 10, c: 1 }, e: { r: 10, c: 3 } },
  ];
  titleStyle(dashboard.A1);
  subtitleStyle(dashboard.A2); subtitleStyle(dashboard.C2);
  subtitleStyle(dashboard.A3); subtitleStyle(dashboard.C3);
  ["A6", "D6"].forEach((a) => cardStyle(dashboard[a], "success"));
  ["A7", "C7"].forEach((a) => cardStyle(dashboard[a], "neutral"));
  ["A8", "C8", "A9"].forEach((a) => cardStyle(dashboard[a], "warning"));
  cardStyle(dashboard.C9, "neutral");
  dashboard.B6.z = "0.0%";
  dashboard.A11.s = { ...(dashboard.A11.s || {}), font: { name: "Arial", sz: 10, bold: true, color: { rgb: "334E68" } }, fill: softFill, alignment: { horizontal: "right", vertical: "center", readingOrder: 2 } };
  finishSheet(dashboard, "A5");
  setWidths(dashboard, [24, 28, 24, 28]);

  const summaryHeader: ExcelCell[] = ["الموظف", "الرقم الوظيفي", "أيام العمل", "حاضر", "غياب", "انصراف مبكر", "تأخر", "تسجيل ناقص", "راحة/عطلة", "ساعات العمل", "نسبة الحضور"];
  const summaryData: ExcelCell[][] = summaries.map((s) => [s.employee.name, s.employee.jobNumber ?? "", s.workDays, s.present, s.absent, s.early, s.late, s.open, s.off, `${Math.floor(s.worked / 60)}س ${s.worked % 60}د`, s.workDays ? s.present / s.workDays : 0]);
  const summary = XLSX.utils.aoa_to_sheet([[`${brandName} · ملخص حضور الموظفين · ${period}`], [], summaryHeader, ...summaryData]);
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: summaryHeader.length - 1 } }];
  autoFitColumns(summary, [summaryHeader, ...summaryData], 12, 30);
  styleExcelTable(summary, 2, Math.max(2, summaryData.length + 2), 0, summaryHeader.length - 1, 2, 0);
  styleReportWorkbook(summary, 4, 3, summaryData.length + 2);
  for (let r = 3; r < summaryData.length + 3; r += 1) {
    const c = summary[XLSX.utils.encode_cell({ r, c: 10 })];
    if (c) { c.z = "0.0%"; c.s = { ...(c.s || {}), font: { name: "Arial", sz: 10, bold: true, color: { rgb: "075985" } }, fill: { fgColor: { rgb: "E0F2FE" } } }; }
  }
  finishSheet(summary, "A3");

  const detailHeader: ExcelCell[] = ["الموظف", "الرقم الوظيفي", "التاريخ", "اليوم", "الحالة", "وقت الحضور", "وقت الانصراف", "مدة العمل", "دقائق التأخر", "دقائق الانصراف المبكر", "تفصيل اليوم"];
  const detail = XLSX.utils.aoa_to_sheet([[`${brandName} · السجل اليومي للحضور والانصراف · ${period}`], [], detailHeader, ...dailyRows.map((r) => [r.employee, r.jobNumber ?? "", r.date, r.day, r.status, r.checkIn, r.checkOut, r.worked, r.late, r.early, r.detail] as ExcelCell[])]);
  detail["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: detailHeader.length - 1 } }];
  autoFitColumns(detail, [detailHeader, ...dailyRows.map((r) => [r.employee, r.jobNumber ?? "", r.date, r.day, r.status, r.checkIn, r.checkOut, r.worked, r.late, r.early, r.detail])], 11, 38);
  styleExcelTable(detail, 2, Math.max(2, dailyRows.length + 2), 0, detailHeader.length - 1, 2, 0);
  styleReportWorkbook(detail, 4, 3, dailyRows.length + 2);
  for (let r = 3; r < dailyRows.length + 3; r += 1) {
    const cell = detail[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cell) cardStyle(cell, statusTone(String(cell.v ?? "")));
  }
  finishSheet(detail, "A3");

  const absenceHeader: ExcelCell[] = ["الموظف", "الرقم الوظيفي", "تاريخ الغياب", "اليوم", "الحالة", "سبب/تفصيل"];
  const absence = XLSX.utils.aoa_to_sheet([[`${brandName} · سجل أيام الغياب · ${period}`], [], absenceHeader, ...absenceRows.map((r) => [r.employee, r.jobNumber ?? "", r.date, r.day, "غياب", r.detail] as ExcelCell[])]);
  absence["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: absenceHeader.length - 1 } }];
  autoFitColumns(absence, [absenceHeader, ...absenceRows.map((r) => [r.employee, r.jobNumber ?? "", r.date, r.day, "غياب", r.detail])], 12, 42);
  styleExcelTable(absence, 2, Math.max(2, absenceRows.length + 2), 0, absenceHeader.length - 1, 2, 0);
  styleReportWorkbook(absence, 4, 3, absenceRows.length + 2);
  finishSheet(absence, "A3");

  const totalStatus = chartData.reduce((sum, x) => sum + x.value, 0);
  const analysisRows = chartData.map((x) => [x.label, x.value, totalStatus ? x.value / totalStatus : 0, "█".repeat(Math.min(45, Math.round((x.value / Math.max(1, ...chartData.map((v) => v.value))) * 45)))] as ExcelCell[]);
  const analysis = XLSX.utils.aoa_to_sheet([[`${brandName} · التحليل التنفيذي للحضور · ${period}`], [], ["الحالة", "العدد", "النسبة", "المؤشر"], ...analysisRows]);
  analysis["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  autoFitColumns(analysis, [["الحالة", "العدد", "النسبة", "المؤشر"], ...analysisRows], 14, 45);
  styleExcelTable(analysis, 2, analysisRows.length + 2, 0, 3, 2, 0);
  styleReportWorkbook(analysis, undefined, 3, analysisRows.length + 2);
  for (let r = 3; r < analysisRows.length + 3; r += 1) { const c = analysis[XLSX.utils.encode_cell({ r, c: 2 })]; if (c) c.z = "0.0%"; }
  finishSheet(analysis, "A3");

  XLSX.utils.book_append_sheet(workbook, dashboard, "لوحة التحكم");
  XLSX.utils.book_append_sheet(workbook, summary, "ملخص الموظفين");
  XLSX.utils.book_append_sheet(workbook, detail, "السجل اليومي");
  XLSX.utils.book_append_sheet(workbook, absence, "أيام الغياب");
  XLSX.utils.book_append_sheet(workbook, analysis, "التحليل التنفيذي");
  [dashboard, summary, detail, absence, analysis].forEach((ws) => setExcelRtl(workbook, ws));

  const blob = new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Hadir-${mode}-${period}-professional-attendance.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
