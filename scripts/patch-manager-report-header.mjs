import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

// The report header has been edited by several historical build patches.
// Replace the rendered header structurally instead of depending on one exact
// whitespace/layout version, so the production build cannot silently retain
// the old department-owner block.
const headerStart = source.indexOf('<div className="flex flex-col items-center gap-2">');
const ownerStart = source.indexOf('<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold">', headerStart);
const ownerEnd = ownerStart >= 0 ? source.indexOf('</div>', source.indexOf('</div>', ownerStart) + 6) : -1;

const newHeader = '<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام ليوم {days[dateOf(date).getDay()]} · {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>';

if (headerStart < 0) throw new Error("ManagerReports: report header start not found.");

// If the source still contains the legacy owner/assistant block, remove it.
let end = ownerEnd >= 0 ? ownerEnd + '</div>'.length : -1;
if (ownerStart >= 0 && end > headerStart) {
  source = source.slice(0, headerStart) + newHeader + source.slice(end);
} else {
  // Otherwise replace the existing branding header up to the next top-level
  // sibling, preserving all report content after it.
  const next = source.indexOf('\n      <div className=', headerStart);
  if (next < 0) throw new Error("ManagerReports: report header boundary not found.");
  source = source.slice(0, headerStart) + newHeader + source.slice(next);
}

// Defensive invariant: the old labels must never reach the built application.
if (source.includes("رئيس القسم") || source.includes("معاون رئيس القسم")) {
  throw new Error("ManagerReports: legacy department owner/assistant header remains after patch.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports header patch: company logo/name + dynamic weekday/date applied; legacy owner/assistant header removed.");
