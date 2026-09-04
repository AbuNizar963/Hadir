import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/EmployeeHome.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`EmployeeHome shift-info patch: ${message}; refusing unsafe replacement.`); };

const arrowAttendance = '<div className="h-10 w-10 rounded-xl bg-primary/12 grid place-items-center text-primary mb-3 text-xl font-black" aria-hidden="true">↓</div>';
const arrowCheckout = '<div className="h-10 w-10 rounded-xl bg-accent/12 grid place-items-center text-accent mb-3 text-xl font-black" aria-hidden="true">↑</div>';
if (!source.includes(arrowAttendance) || !source.includes(arrowCheckout)) {
  fail("attendance/check-out arrow anchors not found in the current EmployeeHome markup");
}
source = source.replace(
  arrowAttendance,
  '<div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-primary/12 grid place-items-center text-primary mb-3 text-4xl sm:text-5xl font-black leading-none" aria-hidden="true">←</div>',
);
source = source.replace(
  arrowCheckout,
  '<div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-accent/12 grid place-items-center text-accent mb-3 text-4xl sm:text-5xl font-black leading-none" aria-hidden="true">→</div>',
);

const requestArrow = '<span className="text-accent text-xl">←</span>';
if (!source.includes(requestArrow)) {
  fail("leave/permission request arrow anchor not found in the current EmployeeHome markup");
}
source = source.replace(
  requestArrow,
  '<span className="text-accent text-4xl sm:text-5xl font-black leading-none" aria-hidden="true">←</span>',
);

const infoAnchor = source.indexOf("معلومات الدوام");
if (infoAnchor < 0) fail("shift information heading not found");
const gridMatch = source.slice(infoAnchor).match(/<div className="grid grid-cols-2 gap-[23] text-xs">/);
if (!gridMatch || gridMatch.index == null) fail("shift information grid not found");
const gridStart = infoAnchor + gridMatch.index;
const gridOpen = gridMatch[0];
const gridClose = "</div></section><button onClick={openRequest}";
const gridEnd = source.indexOf(gridClose, gridStart);
if (gridEnd < 0) fail("shift information grid closing boundary not found");

const gridBody = source.slice(gridStart + gridOpen.length, gridEnd);
const rowPattern = /<Row\s+label=(?:"[^"]*"|\{[^}]*\})\s+value=\{[^}]*\}\s*\/>/g;
const rows = gridBody.match(rowPattern) || [];
if (rows.length < 5) fail(`expected at least 5 existing shift information rows, found ${rows.length}`);

const classify = (row) => {
  if (row.includes('label="الفترة"')) return "period";
  if (row.includes("وقت المناوبة")) return "time";
  if (row.includes('label="الحالة"')) return "status";
  if (row.includes('label="الموقع"')) return "location";
  if (row.includes('label="الجهاز"')) return "device";
  return "other";
};
const byKind = new Map();
for (const row of rows) {
  const kind = classify(row);
  if (!byKind.has(kind)) byKind.set(kind, row);
}
for (const required of ["period", "time", "status", "location", "device"]) {
  if (!byKind.has(required)) fail(`could not locate the existing ${required} row`);
}

const shiftTypeCard = '<div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px]"><div className="text-xs text-muted-foreground">نوع الدوام</div><div className="font-black mt-1">{isRotation?"تناوبي":"إداري"}</div></div>';
const ordered = [shiftTypeCard, byKind.get("period"), byKind.get("time"), byKind.get("status"), byKind.get("location"), byKind.get("device")].filter(Boolean);

source = source.slice(0, gridStart) + gridOpen + ordered.join("") + source.slice(gridEnd);
writeFileSync(file, source, "utf8");
console.log("EmployeeHome shift-info patch: enlarged inward attendance arrows, matched request arrow size, and removed the shift-type SVG icon.");
