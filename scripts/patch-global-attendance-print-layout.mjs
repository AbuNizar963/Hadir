import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const tableAnchor = '        .global-attendance-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; border: 0.8mm solid #111 !important; }';
const tableReplacement = '        .global-attendance-print-table { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; border-collapse: separate !important; border-spacing: 0 !important; table-layout: fixed; font-size: 8pt; border: 0.8mm solid #111 !important; border-radius: 2mm !important; overflow: hidden !important; }';
if (!source.includes(tableAnchor)) throw new Error("GlobalAttendanceReports layout: table CSS anchor not found.");
source = source.replace(tableAnchor, tableReplacement);

const cellAnchor = '        .global-attendance-print-table th, .global-attendance-print-table td { border: 0.25mm solid #111; padding: 2mm 1.5mm; vertical-align: middle; overflow-wrap: anywhere; }';
const cellReplacement = '        .global-attendance-print-table th, .global-attendance-print-table td { border: 0 !important; border-left: 0.25mm solid #111 !important; border-bottom: 0.25mm solid #111 !important; padding: 1.2mm 1mm; vertical-align: middle; overflow-wrap: anywhere; word-break: break-word; box-sizing: border-box; }\n        .global-attendance-print-table th:last-child, .global-attendance-print-table td:last-child { border-left: 0 !important; }\n        .global-attendance-print-table thead tr:first-child th { border-top: 0 !important; }\n        .global-attendance-print-table tbody tr:last-child td { border-bottom: 0 !important; }\n        .global-attendance-print-table th:first-child, .global-attendance-print-table td:first-child { border-right: 0.25mm solid #111 !important; }';
if (!source.includes(cellAnchor)) throw new Error("GlobalAttendanceReports layout: cell CSS anchor not found.");
source = source.replace(cellAnchor, cellReplacement);

const printAnchor = '        .global-attendance-print { display: block !important; position: static !important; inset: auto !important; width: 100% !important; min-height: 0 !important; box-sizing: border-box !important; background: #fff !important; color: #000 !important; padding: 0 !important; margin: 0 !important; }';
const printReplacement = '        .manager-content > *:has(.global-attendance-print) { display: block !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; }\n        .manager-content > *:has(.global-attendance-print) > *:not(.global-attendance-print):not(style) { display: none !important; }\n        .global-attendance-print { display: block !important; position: static !important; inset: auto !important; width: 100% !important; max-width: 100% !important; min-height: 0 !important; box-sizing: border-box !important; background: #fff !important; color: #000 !important; padding: 0 !important; margin: 0 !important; }';
if (!source.includes(printAnchor)) throw new Error("GlobalAttendanceReports layout: print container CSS anchor not found.");
source = source.replace(printAnchor, printReplacement);

writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports print layout patch: fit table to A4, fix outer borders/corners, and remove trailing blank pages.");
