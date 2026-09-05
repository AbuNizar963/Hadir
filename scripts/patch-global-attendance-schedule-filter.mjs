import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const importAnchor = 'import { getEmployees } from "@/lib/storage";';
if (!source.includes('getEmployeeWorkPeriod')) {
  if (!source.includes(importAnchor)) throw new Error("GlobalAttendanceReports: storage import anchor not found.");
  source = source.replace(importAnchor, `${importAnchor}\nimport { getEmployeeWorkPeriod } from "@/lib/schedule";`);
}

const old = 'try { setReport(await getProfessionalAttendanceReport(from, to, employeeId || undefined)); }';
const replacement = `try {\n      const nextReport = await getProfessionalAttendanceReport(from, to, employeeId || undefined);\n      // A daily report must contain only employees whose schedule says they work\n      // on the selected date. REST/NOT_STARTED/INVALID rows are not reportable\n      // attendance rows for that day.\n      if (from === to) {\n        const eligibleIds = new Set(employees.filter((employee) => getEmployeeWorkPeriod(employee, new Date(`${from}T12:00:00`)).isWorkDay).map((employee) => String(employee.id)));\n        const filteredRows = nextReport.rows.filter((row) => eligibleIds.has(String(row.employeeId)) && !["REST", "NOT_STARTED", "INVALID"].includes(String(row.status)));\n        const filteredIds = new Set(filteredRows.map((row) => String(row.employeeId)));\n        nextReport.rows = filteredRows;\n        nextReport.analytics.employeeSummaries = nextReport.analytics.employeeSummaries.filter((row) => filteredIds.has(String(row.employeeId)));\n        nextReport.analytics.exceptions = nextReport.analytics.exceptions.filter((row) => filteredIds.has(String(row.employeeId)));\n        nextReport.summary.employees = filteredIds.size;\n        nextReport.summary.employeeDays = filteredRows.length;\n        nextReport.summary.rest = 0;\n        nextReport.summary.notStarted = 0;\n        nextReport.summary.invalid = 0;\n      }\n      setReport(nextReport);\n    }`;
if (!source.includes(old)) throw new Error("GlobalAttendanceReports: report load anchor not found.");
source = source.replace(old, replacement);

if (!source.includes('getEmployeeWorkPeriod')) throw new Error("GlobalAttendanceReports: schedule filter import was not applied.");
if (!source.includes('eligibleIds')) throw new Error("GlobalAttendanceReports: daily schedule filter was not applied.");

writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports patch: daily date filter now keeps only employees scheduled to work on the selected date and removes REST/NOT_STARTED/INVALID rows.");
