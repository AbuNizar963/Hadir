import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const old = 'try { setReport(await getProfessionalAttendanceReport(from, to, employeeId || undefined)); }';
const replacement = `try {\n      const nextReport = await getProfessionalAttendanceReport(from, to, employeeId || undefined);\n      // For a single selected date, show only employees who are scheduled to\n      // work that day. The professional report already resolves the schedule,\n      // so REST/NOT_STARTED/INVALID are authoritative non-working states.\n      if (from === to) {\n        const filteredRows = nextReport.rows.filter((row) => !["REST", "NOT_STARTED", "INVALID"].includes(String(row.status)));\n        const filteredIds = new Set(filteredRows.map((row) => String(row.employeeId)));\n        nextReport.rows = filteredRows;\n        nextReport.analytics.employeeSummaries = nextReport.analytics.employeeSummaries.filter((row) => filteredIds.has(String(row.employeeId)));\n        nextReport.analytics.exceptions = nextReport.analytics.exceptions.filter((row) => filteredIds.has(String(row.employeeId)));\n        nextReport.summary.employees = filteredIds.size;\n        nextReport.summary.employeeDays = filteredRows.length;\n        nextReport.summary.rest = 0;\n        nextReport.summary.notStarted = 0;\n        nextReport.summary.invalid = 0;\n      }\n      setReport(nextReport);\n    }`;
if (!source.includes(old)) throw new Error("GlobalAttendanceReports: report load anchor not found.");
source = source.replace(old, replacement);

if (!source.includes('REST/NOT_STARTED/INVALID')) throw new Error("GlobalAttendanceReports: daily schedule filter was not applied.");

writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports patch: daily date filter now removes REST/NOT_STARTED/INVALID employees from the selected-day report.");
