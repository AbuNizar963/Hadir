import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const headerStart = source.indexOf('<div className="flex flex-col items-center gap-2">');
const ownerStart = source.indexOf('<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold">', headerStart);
const newHeader = '<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام ليوم {days[dateOf(date).getDay()]} · {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>';

if (headerStart < 0) throw new Error("ManagerReports: report header start not found.");

if (ownerStart >= 0) {
  const ownerBlockEnd = source.indexOf('</div>', source.indexOf('</div>', source.indexOf('</div>', ownerStart) + 6) + 6);
  if (ownerBlockEnd < 0) throw new Error("ManagerReports: legacy owner/assistant block boundary not found.");
  source = source.slice(0, headerStart) + newHeader + source.slice(ownerBlockEnd + '</div>'.length);
} else {
  const headerEnd = source.indexOf('</div>', source.indexOf('</div>', source.indexOf('</div>', headerStart) + 6) + 6);
  if (headerEnd < 0) throw new Error("ManagerReports: branding header boundary not found.");
  source = source.slice(0, headerStart) + newHeader + source.slice(headerEnd + '</div>'.length);
}

if (source.includes("رئيس القسم") || source.includes("معاون رئيس القسم")) {
  throw new Error("ManagerReports: legacy department owner/assistant header remains after patch.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports header patch: company branding and dynamic weekday/date applied; legacy department owner/assistant removed.");
