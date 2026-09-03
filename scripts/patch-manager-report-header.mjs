import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const headerStart = source.indexOf('<div className="flex flex-col items-center gap-2">');
const ownerStart = source.indexOf('<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold">', headerStart);
const newHeader = '<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-[3.1cm] w-[3.1cm] object-contain shrink-0" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام ليوم {days[dateOf(date).getDay()]} · {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>';

if (headerStart < 0) throw new Error("ManagerReports: report header start not found.");

if (!source.includes('getBackendSettings')) {
  const importAnchor = 'import { getBackendAudit, getBackendEmployees, getBackendRequests } from "@/lib/backend";';
  if (!source.includes(importAnchor)) throw new Error("ManagerReports: backend import anchor not found.");
  source = source.replace(importAnchor, 'import { getBackendAudit, getBackendEmployees, getBackendRequests, getBackendSettings } from "@/lib/backend";');
}

const settingsAnchor = '  const settings = getSettings();\n';
if (source.includes(settingsAnchor)) {
  const hydratedSettings = '  const [reportSettings, setReportSettings] = useState(() => getSettings());\n  const settings = reportSettings;\n  useEffect(() => { let alive = true; const loadReportSettings = async () => { try { const remote = await getBackendSettings(); if (!alive || !remote) return; setReportSettings(current => ({ ...current, ...remote, adminAccounts: Array.isArray(remote.adminAccounts) ? remote.adminAccounts : current.adminAccounts })); } catch (error) { console.warn("تعذر تحميل إعدادات التقرير من D1:", error); } }; void loadReportSettings(); const onSettingsChanged = () => { setReportSettings(getSettings()); void loadReportSettings(); }; window.addEventListener("hadir:cloud-data-changed", onSettingsChanged); window.addEventListener("hadir:d1-view-changed", onSettingsChanged); return () => { alive = false; window.removeEventListener("hadir:cloud-data-changed", onSettingsChanged); window.removeEventListener("hadir:d1-view-changed", onSettingsChanged); }; }, []);\n';
  source = source.replace(settingsAnchor, hydratedSettings);
} else if (!source.includes('const [reportSettings, setReportSettings]')) {
  throw new Error("ManagerReports: settings state anchor not found.");
}

if (source.includes('className="h-14 w-auto max-w-[180px] object-contain"')) {
  source = source.replace(/<div className="flex flex-col items-center gap-2">[\s\S]*?<\/div>/, newHeader);
} else if (source.includes('className="h-[3.1cm] w-[3.1cm] object-contain shrink-0"')) {
  source = source.replace(/<div className="flex flex-col items-center gap-2">[\s\S]*?<\/div>/, newHeader);
} else if (ownerStart >= 0) {
  const ownerBlockEnd = source.indexOf('</div>', source.indexOf('</div>', source.indexOf('</div>', ownerStart) + 6) + 6);
  if (ownerBlockEnd < 0) throw new Error("ManagerReports: legacy owner/assistant block boundary not found.");
  source = source.slice(0, headerStart) + newHeader + source.slice(ownerBlockEnd + '</div>'.length);
} else {
  const headerEnd = source.indexOf('</div>', source.indexOf('</div>', source.indexOf('</div>', headerStart) + 6) + 6);
  if (headerEnd < 0) throw new Error("ManagerReports: branding header boundary not found.");
  source = source.slice(0, headerStart) + newHeader + source.slice(headerEnd + '</div>'.length);
}

source = source.replace(/<td className="p-2 border-l border-black\/20 font-bold break-words">\{row\.employee\.name\}<div className="font-normal text-\[10px\] mt-0\.5">\{row\.employee\.jobNumber\}<\/div><\/td>/, '<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}</td>');
source = source.replace(/\.service-report img \{[^}]*\}/, '.service-report img { width: 31mm !important; height: 31mm !important; max-width: 31mm !important; max-height: 31mm !important; object-fit: contain !important; }');

if (!source.includes('const [reportSettings, setReportSettings]')) throw new Error("ManagerReports: report settings hydration was not applied.");
if (!source.includes('getBackendSettings')) throw new Error("ManagerReports: backend settings hydration import was not applied.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports header patch: D1 settings hydrated on first mount; settings changes refresh report immediately; ordered specialties retained; company logo fixed at 3.1cm x 3.1cm; selected weekday/date applied; employee self number removed from daily report.");
