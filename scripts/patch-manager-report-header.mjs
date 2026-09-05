import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

if (!source.includes("getBackendSettings")) {
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

// Replace only the exact daily-report header block. Do not use character offsets or broad regexes.
const oldHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>\n        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold"><div>رئيس القسم : {settings.ownerName || "—"}</div><div>معاون رئيس القسم : {settings.managerName || "—"}</div></div>`;
const newHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-[3.1cm] w-[3.1cm] object-contain shrink-0" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">سجل الحضور والغياب ليوم {days[dateOf(date).getDay()]} {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>`;

if (!source.includes(oldHeaderBlock)) throw new Error("ManagerReports: exact daily report header block not found.");
source = source.replace(oldHeaderBlock, newHeaderBlock);

const oldEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}<div className="font-normal text-[10px] mt-0.5">{row.employee.jobNumber}</div></td>`;
const newEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}</td>`;
if (!source.includes(oldEmployeeCell)) throw new Error("ManagerReports: daily employee self-number cell not found.");
source = source.replace(oldEmployeeCell, newEmployeeCell);

// The daily service report is for today's scheduled workforce only: rotation employees
// who are on duty and administrative employees whose configured workday includes the date.
// Do not emit rotation rest days or administrative weekly-off days.
if (!source.includes('const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(summaries.filter')) {
  const dailyRowsAnchor = 'const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(summaries, dates, index, settings, requests, dailyStatusByDate) : [],';
  if (!source.includes(dailyRowsAnchor)) throw new Error("ManagerReports: daily service rows anchor not found.");
  const dailyRowsReplacement = 'const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(summaries.filter(s => getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay), dates, index, settings, requests, dailyStatusByDate) : [],';
  source = source.replace(dailyRowsAnchor, dailyRowsReplacement);
}

const oldPageCss = "@page { size: A4 landscape; margin: 5mm 6mm; }";
const newPageCss = "@page { size: A4 portrait; margin: 6mm; }";
if (!source.includes(oldPageCss)) throw new Error("ManagerReports: inline print page rule not found.");
source = source.replace(oldPageCss, newPageCss);

const oldLogoCss = ".service-report img { max-height: 10mm !important; }";
const newLogoCss = ".service-report img { width: 31mm !important; height: 31mm !important; max-width: 31mm !important; max-height: 31mm !important; object-fit: contain !important; }";
if (!source.includes(oldLogoCss)) throw new Error("ManagerReports: inline logo print rule not found.");
source = source.replace(oldLogoCss, newLogoCss);

if (!source.includes('const [reportSettings, setReportSettings]')) throw new Error("ManagerReports: settings hydration was not applied.");
if (!source.includes('getBackendSettings')) throw new Error("ManagerReports: backend settings hydration import was not applied.");
if (!source.includes('className="h-[3.1cm] w-[3.1cm]')) throw new Error("ManagerReports: 3.1cm logo markup was not applied.");
if (!source.includes('row.employee.name}</td>')) throw new Error("ManagerReports: employee self number removal was not applied.");
if (!source.includes(newPageCss)) throw new Error("ManagerReports: A4 portrait print rule was not applied.");
if (!source.includes(newLogoCss)) throw new Error("ManagerReports: 31mm logo print rule was not applied.");
if (!source.includes('const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(summaries.filter')) throw new Error("ManagerReports: daily scheduled-employee filter was not applied.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports header patch: exact daily header replacement; D1 settings hydrated on first mount; settings changes refresh report immediately; ordered specialties retained; company logo fixed at 3.1cm x 3.1cm; سجل الحضور والغياب wording with selected weekday/date applied; employee self number removed from daily report; daily report limited to employees scheduled to work on the selected date; print output standardized to A4 portrait.");
