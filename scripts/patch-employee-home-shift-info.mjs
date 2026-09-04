import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/EmployeeHome.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`EmployeeHome shift-info patch: ${message}; refusing unsafe replacement.`); };

const arrowAttendance = '<div className="text-xl font-black" aria-hidden="true">↓</div>';
const arrowCheckout = '<div className="text-xl font-black" aria-hidden="true">↑</div>';
if (!source.includes(arrowAttendance) || !source.includes(arrowCheckout)) {
  fail("attendance/check-out arrow anchors not found");
}
source = source.replace(arrowAttendance, '<div className="text-4xl sm:text-5xl font-black leading-none" aria-hidden="true">→</div>');
source = source.replace(arrowCheckout, '<div className="text-4xl sm:text-5xl font-black leading-none" aria-hidden="true">←</div>');

const infoAnchor = source.indexOf("معلومات الدوام");
if (infoAnchor < 0) fail("shift information heading not found");
const gridOpen = '<div className="grid grid-cols-2 gap-3">';
const gridStart = source.indexOf(gridOpen, infoAnchor);
if (gridStart < 0) fail("shift information grid not found");
const openEnd = gridStart + gridOpen.length;

let depth = 1;
let childStart = null;
const children = [];
const tagPattern = /<\/?div\b[^>]*>/g;
tagPattern.lastIndex = openEnd;
let match;
let gridEnd = -1;
while ((match = tagPattern.exec(source))) {
  const tag = match[0];
  if (/^<div\b/.test(tag)) {
    if (depth === 1) childStart = match.index;
    depth += 1;
  } else {
    depth -= 1;
    if (depth === 1 && childStart != null) {
      children.push(source.slice(childStart, match.index + tag.length));
      childStart = null;
    }
    if (depth === 0) {
      gridEnd = match.index + tag.length;
      break;
    }
  }
}
if (gridEnd < 0 || children.length < 5) fail(`expected at least 5 shift information cards, found ${children.length}`);

const classify = (card) => {
  if (card.includes("الفترة")) return "period";
  if (card.includes("وقت الدوام")) return "time";
  if (card.includes("الحالة")) return "status";
  if (card.includes("الموقع")) return "location";
  if (card.includes("الجهاز")) return "device";
  return "other";
};
const byKind = new Map();
for (const card of children) {
  const kind = classify(card);
  if (!byKind.has(kind)) byKind.set(kind, card);
}
for (const required of ["period", "time", "status", "location", "device"]) {
  if (!byKind.has(required)) fail(`could not locate the existing ${required} card`);
}

const shiftTypeCard = '<div className="rounded-2xl border border-border/60 bg-background/30 p-3.5 min-h-[92px]"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-muted-foreground">نوع الدوام</div><div className="font-black mt-1">{isRotation?"تناوبي":"إداري"}</div></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10"/><path d="M7 12h6"/><path d="M7 17h10"/><path d="M17 10l3 2-3 2"/></svg></span></div></div>';
const ordered = [shiftTypeCard, byKind.get("period"), byKind.get("time"), byKind.get("status"), byKind.get("location"), byKind.get("device")].filter(Boolean);

source = source.slice(0, gridStart) + gridOpen + ordered.join("") + source.slice(gridEnd);
writeFileSync(file, source, "utf8");
console.log("EmployeeHome shift-info patch: enlarged horizontal attendance arrows and reordered shift information with shift-type indicator.");
