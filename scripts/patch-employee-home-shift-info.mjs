import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/EmployeeHome.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`EmployeeHome shift-info patch: ${message}; refusing unsafe replacement.`); };

// Patch only the existing action cards. Do not replace the EmployeeHome source wholesale.
const patchActionArrow = (linkPath, arrow, toneClass) => {
  const linkStart = source.indexOf(`<Link to="${linkPath}"`);
  if (linkStart < 0) fail(`action link anchor not found: ${linkPath}`);
  const linkEnd = source.indexOf("</Link>", linkStart);
  if (linkEnd < 0) fail(`action link closing boundary not found: ${linkPath}`);
  const block = source.slice(linkStart, linkEnd);
  const arrowPattern = /<(?:div|span)\b[^>]*>\s*[←→↓↑]\s*<\/(?:div|span)>/;
  if (!arrowPattern.test(block)) fail(`existing arrow anchor not found inside ${linkPath}`);
  const replacement = `<div className="absolute ${linkPath.endsWith("check-in") ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-${toneClass}/12 flex items-center justify-center ${toneClass} text-5xl sm:text-6xl font-black leading-none" aria-hidden="true">${arrow}</div>`;
  const nextBlock = block.replace(arrowPattern, replacement);
  source = source.slice(0, linkStart) + nextBlock + source.slice(linkEnd);
};

patchActionArrow("/employee/scan/check-in", "↓", "accent");
patchActionArrow("/employee/scan/check-out", "↓", "primary");

const requestAnchor = /<span className="text-accent text-[^"]+">[←→↓↑]<\/span>/;
const requestStart = source.indexOf("طلب استئذان أو إجازة");
if (requestStart < 0) fail("leave/permission request heading not found");
const requestCardStart = source.lastIndexOf("<button", requestStart);
const requestCardEnd = source.indexOf("</button>", requestStart);
if (requestCardStart < 0 || requestCardEnd < 0) fail("leave/permission request card boundary not found");
const requestBlock = source.slice(requestCardStart, requestCardEnd);
if (!requestAnchor.test(requestBlock)) fail("leave/permission request arrow anchor not found");
source = source.slice(0, requestCardStart) + requestBlock.replace(
  requestAnchor,
  '<span className="inline-flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-accent/12 items-center justify-center text-accent text-5xl sm:text-6xl font-black leading-none" aria-hidden="true">←</span>',
) + source.slice(requestCardEnd);

// Use one exact visual template for all six shift-information cards.
const cardTemplate = (valueExpression) => `<div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px] flex flex-col justify-start"><div className="font-black text-sm leading-6">${valueExpression ? "نوع الدوام" : ""}</div><div className="font-normal text-sm leading-6 mt-1 break-words">${valueExpression || "{value}"}</div></div>`;

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

// Rotation card uses the exact same markup template as every Row card.
const shiftTypeCard = '<div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px] flex flex-col justify-start"><div className="font-black text-sm leading-6">نوع الدوام</div><div className="font-normal text-sm leading-6 mt-1 break-words">{isRotation?"تناوبي":"إداري"}</div></div>';
const ordered = [shiftTypeCard, byKind.get("period"), byKind.get("time"), byKind.get("status"), byKind.get("location"), byKind.get("device")].filter(Boolean);
source = source.slice(0, gridStart) + gridOpen + ordered.join("") + source.slice(gridEnd);
writeFileSync(file, source, "utf8");
console.log("EmployeeHome shift-info patch: green/blue attendance arrows point down and are vertically centered; request arrow is centered in its icon; rotation card exactly matches all shift-info cards.");
