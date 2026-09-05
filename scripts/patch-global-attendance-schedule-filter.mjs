import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const old = 'try { setReport(await getProfessionalAttendanceReport(from, to, employeeId || undefined)); }';
const replacement = `try {
      const nextReport = await getProfessionalAttendanceReport(from, to, employeeId || undefined);
      // For a single selected date, show only employees who are scheduled to
      // work that day. The professional report already resolves the schedule,
      // so REST/NOT_STARTED/INVALID are authoritative non-working states.
      if (from === to) {
        const filteredRows = nextReport.rows.filter((row) => !["REST", "NOT_STARTED", "INVALID"].includes(String(row.status)));
        const filteredIds = new Set(filteredRows.map((row) => String(row.employeeId)));
        nextReport.rows = filteredRows;
        nextReport.analytics.employeeSummaries = nextReport.analytics.employeeSummaries.filter((row) => filteredIds.has(String(row.employeeId)));
        nextReport.analytics.exceptions = nextReport.analytics.exceptions.filter((row) => filteredIds.has(String(row.employeeId)));
        nextReport.summary.employees = filteredIds.size;
        nextReport.summary.employeeDays = filteredRows.length;
        nextReport.summary.rest = 0;
        nextReport.summary.notStarted = 0;
        nextReport.summary.invalid = 0;
      }
      setReport(nextReport);
    }`;
if (!source.includes(old)) throw new Error("GlobalAttendanceReports: report load anchor not found.");
source = source.replace(old, replacement);

if (!source.includes('REST/NOT_STARTED/INVALID')) throw new Error("GlobalAttendanceReports: daily schedule filter was not applied.");

writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports patch: daily date filter now removes REST/NOT_STARTED/INVALID employees from the selected-day report.");
