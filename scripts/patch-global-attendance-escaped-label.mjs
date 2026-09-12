import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/GlobalAttendanceReports.tsx";
if (!existsSync(file)) throw new Error("GlobalAttendanceReports status-label patch: source file not found.");

const source = readFileSync(file, "utf8");
const escapedWrong = 'ESCAPED: "انصراف دون تسجيل"';
const escapedLegacy = 'ESCAPED: "هروب"';
const escapedCorrect = 'ESCAPED: "هروب من العمل"';
const openWrong = 'OPEN: "دوام مفتوح"';
const openCorrect = 'OPEN: "انصراف معلق"';

let updated = source;

if (updated.includes(escapedWrong)) updated = updated.replace(escapedWrong, escapedCorrect);
else if (updated.includes(escapedLegacy)) updated = updated.replace(escapedLegacy, escapedCorrect);
else if (!updated.includes(escapedCorrect)) {
  throw new Error("GlobalAttendanceReports status-label patch: expected ESCAPED label was not found; refusing unsafe replacement.");
}

if (updated.includes(openWrong)) updated = updated.replace(openWrong, openCorrect);
else if (!updated.includes(openCorrect)) {
  throw new Error("GlobalAttendanceReports status-label patch: expected OPEN label was not found; refusing unsafe replacement.");
}

const escapedCount = (updated.match(/ESCAPED:/g) || []).length;
const openCount = (updated.match(/OPEN:/g) || []).length;
if (updated === source || escapedCount !== 1 || openCount !== 1 || !updated.includes(escapedCorrect) || !updated.includes(openCorrect)) {
  throw new Error("GlobalAttendanceReports status-label patch: replacement validation failed.");
}

writeFileSync(file, updated, "utf8");
console.log("GlobalAttendanceReports status-label patch: ESCAPED=هروب من العمل, OPEN=انصراف معلق.");