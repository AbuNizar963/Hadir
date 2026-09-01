import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

source = source.replace('if (!rotation || rotationCheckOutDay) worked += wd;', 'if (!rotation || rotationCheckInDay) worked += wd;');
source = source.replace('if (!rotation || rotationCheckOutDay) earlyMinutes += em;', 'if (!rotation || rotationCheckInDay) earlyMinutes += em;');
source = source.replace('      else if (rotationCheckOutDay && em) early++;', '      else if (rotationCheckInDay && em) early++;');

writeFileSync(file, source, "utf8");
console.log("ManagerReports final2 patch: rotation duration counted once.");
