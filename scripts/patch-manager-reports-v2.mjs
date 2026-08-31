import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const anchor = '    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;';
const addition = `${anchor}\n    const rotationCheckInDay = rotation && rotationCheckIn ? key(rotationCheckIn.timestamp!) === k : false;\n    const rotationCheckOutDay = rotation && rotationCheckOut ? key(rotationCheckOut.timestamp!) === k : false;`;

// Only the detail function needs this addition; the summary function already has it.
const first = source.indexOf(anchor);
const second = source.indexOf(anchor, first + anchor.length);
if (first < 0 || second < 0) throw new Error("ManagerReports v2: attendance anchor not found twice.");
if (!source.slice(first, second).includes("const rotationCheckInDay")) {
  source = source.slice(0, first) + addition + source.slice(first + anchor.length);
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports v2 patch applied.");
