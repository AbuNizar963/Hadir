import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const oldHeader = `        <div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>\n        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold"><div>رئيس القسم : {settings.ownerName || "—"}</div><div>معاون رئيس القسم : {settings.managerName || "—"}</div></div>`;

const newHeader = `        <div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام ليوم {days[dateOf(date).getDay()]} · {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>`;

if (source.includes(newHeader)) {
  console.log("ManagerReports header patch: already applied.");
  process.exit(0);
}
if (!source.includes(oldHeader)) throw new Error("ManagerReports: report header anchor not found.");
source = source.replace(oldHeader, newHeader);
writeFileSync(file, source, "utf8");
console.log("ManagerReports header patch: removed department owner/assistant and added company branding with deterministic weekday/date.");
