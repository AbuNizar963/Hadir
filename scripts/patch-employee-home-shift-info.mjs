import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/EmployeeHome.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`EmployeeHome shift-info patch: ${message}; refusing unsafe replacement.`); };

// The source is intentionally kept untouched; only the exact existing UI anchors are patched.
const arrowAttendance = '<div className="h-10 w-10 rounded-xl bg-primary/12 grid place-items-center text-primary mb-3 text-xl font-black" aria-hidden="true">↓</div>';
const arrowCheckout = '<div className="h-10 w-10 rounded-xl bg-accent/12 grid place-items-center text-accent mb-3 text-xl font-black" aria-hidden="true">↑</div>';
if (!source.includes(arrowAttendance) || !source.includes(arrowCheckout)) {
  fail("attendance/check-out arrow anchors not found in the current EmployeeHome markup");
}

const checkInLink = '<Link to="/employee/scan/check-in" aria-disabled={!canCheckIn} className={`hud-card p-4 sm:p-5 transition-transform ${!canCheckIn?"opacity-45 pointer-events-none":"hover:-translate-y-0.5"}`}>';
const checkOutLink = '<Link to="/employee/scan/check-out" aria-disabled={!canCheckOut} className={`hud-card p-4 sm:p-5 transition-transform ${!canCheckOut?"opacity-45 pointer-events-none":"hover:-translate-y-0.5"}`}>';
if (!source.includes(checkInLink) || !source.includes(checkOutLink)) {
  fail("attendance action link anchors not found in the current EmployeeHome markup");
}
source = source.replace(checkInLink, checkInLink.replace('className={`hud-card', 'className={`relative hud-card'));
source = source.replace(checkOutLink, checkOutLink.replace('className={`hud-card', 'className={`relative hud-card'));
source = source.replace(
  arrowAttendance,
  '<div className="absolute right-4 top-1/2 -translate-y-1/2 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-primary/12 flex items-center justify-center text-primary text-5xl sm:text-6xl font-black leading-none" aria-hidden="true">←</div>',
);
source = source.replace(
  arrowCheckout,
  '<div className="absolute left-4 top-1/2 -translate-y-1/2 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-accent/12 flex items-center justify-center text-accent text-5xl sm:text-6xl font-black leading-none" aria-hidden="true">→</div>',
);

const requestArrow = '<span className="text-accent text-xl">←</span>';
if (!source.includes(requestArrow)) {
  fail("leave/permission request arrow anchor not found in the current EmployeeHome markup");
}
source = source.replace(
  requestArrow,
  '<span className="inline-flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-accent/12 items-center justify-center text-accent text-5xl sm:text-6xl font-black leading-none" aria-hidden="true">←</span>',
);

// Keep all six shift-information cards identical: same dimensions, typography,
// spacing, border/background, with bold labels and regular values/details.
const rowSignature = "function Row({label,value}:{label:string;value:string})";
const rowStart = source.indexOf(rowSignature);
if (rowStart < 0) fail("shift information Row component not found");
const rowBodyOpen = source.indexOf("{", rowStart + rowSignature.length);
if (rowBodyOpen < 0) fail("shift information Row body not found");
let depth = 0;
let quote = null;
let escaped = false;
let rowEnd = -1;
for (let i = rowBodyOpen; i < source.length; i += 1) {
  const ch = source[i];
  if (quote) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === quote) quote = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
  if (ch === "{") depth += 1;
  else if (ch === "}") {
    depth -= 1;
    if (depth === 0) { rowEnd = i + 1; break; }
  }
}
if (rowEnd < 0) fail("could not safely determine the end of the Row component");
const standardizedRow = 'function Row({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px] flex flex-col justify-start"><div className="font-black text-sm leading-6">{label}</div><div className="font-normal text-sm leading-6 mt-1 break-words">{value}</div></div>}';
source = source.slice(0, rowStart) + standardizedRow + source.slice(rowEnd);

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

const shiftTypeCard = '<div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px] flex flex-col justify-start"><div className="font-black text-sm leading-6">نوع الدوام</div><div className="font-normal text-sm leading-6 mt-1 break-words">{isRotation?"تناوبي":"إداري"}</div></div>';
const ordered = [shiftTypeCard, byKind.get("period"), byKind.get("time"), byKind.get("status"), byKind.get("location"), byKind.get("device")].filter(Boolean);
source = source.slice(0, gridStart) + gridOpen + ordered.join("") + source.slice(gridEnd);
writeFileSync(file, source, "utf8");
console.log("EmployeeHome shift-info patch: repaired anchors; unified shift cards; bold labels/regular details; attendance arrows centered vertically at outer card edges; request arrow centered inside its icon.");
