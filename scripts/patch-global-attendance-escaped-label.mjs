import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/GlobalAttendanceReports.tsx";
if (!existsSync(file)) throw new Error("GlobalAttendanceReports escaped-label patch: source file not found.");

const source = readFileSync(file, "utf8");
const wrong = 'ESCAPED: "انصراف دون تسجيل"';
const correct = 'ESCAPED: "هروب"';

if (source.includes(correct)) {
  console.log("GlobalAttendanceReports escaped-label patch: already applied.");
  process.exit(0);
}
if (!source.includes(wrong)) {
  throw new Error("GlobalAttendanceReports escaped-label patch: expected escaped label was not found; refusing unsafe replacement.");
}

const updated = source.replace(wrong, correct);
if (updated === source || (updated.match(/ESCAPED:/g) || []).length !== 1) {
  throw new Error("GlobalAttendanceReports escaped-label patch: replacement validation failed.");
}

writeFileSync(file, updated, "utf8");
console.log("GlobalAttendanceReports escaped-label patch: ESCAPED is now labeled هروب.");
