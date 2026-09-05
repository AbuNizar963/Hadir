import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const old = 'const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);';
const replacement = 'const [from, setFrom] = useState(today);';
if (!source.includes(old) && !source.includes(replacement)) throw new Error("GlobalAttendanceReports: default from-date anchor not found.");
if (source.includes(old)) source = source.replace(old, replacement);
writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports patch: default report date is today.");
