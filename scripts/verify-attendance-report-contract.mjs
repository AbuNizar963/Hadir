import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const webReport = read("../src/pages/GlobalAttendanceReports.tsx");
const reportClient = read("../src/lib/professionalAttendanceReport.ts");
const workbookExport = read("../src/lib/professionalReportExport.ts");
const attendanceCenter = read("../backend/src/attendance-center-api.ts");
const reportEngine = read("../backend/src/professional-attendance-report-engine.ts");

const checks = [
  [
    "Web classifies missing checkout as a report exception",
    webReport.includes(
      'row.exceptionCode === "MISSING_CHECKOUT" ? "MISSING_CHECKOUT" : row.status',
    ),
  ],
  [
    "Web exports the complete canonical report rows",
    webReport.includes("rows.map((row) => [") &&
      webReport.includes("downloadProfessionalAttendanceReport"),
  ],
  [
    "Web report client reads the central attendance-center endpoint",
    reportClient.includes("/api/manager/attendance-center") &&
      reportClient.includes("reportable row set as-is"),
  ],
  [
    "Daily and historical report calculation share the canonical server engine",
    attendanceCenter.includes("handleDailyStatus") &&
      attendanceCenter.includes("buildProfessionalAttendanceReport"),
  ],
  [
    "The report endpoint remains read-only for raw attendance",
    attendanceCenter.includes("noRawAttendanceMutation: true"),
  ],
  [
    "The workbook keeps all five official report sheets",
    [
      "لوحة التحكم",
      "ملخص الموظفين",
      "السجل اليومي",
      "أيام الغياب",
      "التحليل التنفيذي",
    ].every((name) => workbookExport.includes(name)),
  ],
  [
    "The canonical report exposes employee-day totals used by both clients",
    reportClient.includes("employeeDays: number") &&
      reportClient.includes("attendanceRate: number"),
  ],
  [
    "The daily series exposes the canonical date and attendance status counts",
    reportClient.includes("attendanceDay: string") &&
      reportClient.includes("present: number") &&
      reportClient.includes("late: number") &&
      reportClient.includes("absent: number"),
  ],
  [
    "The web workbook carries attendance source into daily and absence sheets",
    webReport.includes("specialty: row.attendanceSource") &&
      workbookExport.includes("attendanceSource"),
  ],
  [
    "Historical reports retain the canonical rotation visibility rule",
    reportEngine.includes("isRotationVisibleDay") &&
      reportEngine.includes("shouldIncludeReportRow"),
  ],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? "PASS" : "FAIL"} · ${name}\n`);
}
if (failed.length) {
  throw new Error(
    `Attendance report contract validation failed: ${failed.map(([name]) => name).join("; ")}`,
  );
}
console.log("Canonical attendance and report export contract verified.");
