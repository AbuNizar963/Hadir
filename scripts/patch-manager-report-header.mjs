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
} else if (!source.includes('const [reportSettings, setReportSettings]')) throw new Error("ManagerReports: settings state anchor not found.");

const currentHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>`;
const legacyHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>\n        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold"><div>رئيس القسم : {settings.ownerName || "—"}</div><div>معاون رئيس القسم : {settings.managerName || "—"}</div></div>`;
const newHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-[3.1cm] w-[3.1cm] object-contain shrink-0" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">سجل الحضور والغياب ليوم {days[dateOf(date).getDay()]} {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>`;
if (source.includes(legacyHeaderBlock)) source = source.replace(legacyHeaderBlock, newHeaderBlock);
else if (source.includes(currentHeaderBlock)) source = source.replace(currentHeaderBlock, newHeaderBlock);
else if (!source.includes(newHeaderBlock)) throw new Error("ManagerReports: daily report header block not found.");

const oldEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}<div className="font-normal text-[10px] mt-0.5">{row.employee.jobNumber}</div></td>`;
const newEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}</td>`;
if (source.includes(oldEmployeeCell)) source = source.replace(oldEmployeeCell, newEmployeeCell);

const dailyRowsStart = 'const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(';
const dailyRowsIndex = source.indexOf(dailyRowsStart);
if (dailyRowsIndex === -1) throw new Error("ManagerReports: daily service rows declaration not found.");
const dailyRowsEnd = source.indexOf(') : [],', dailyRowsIndex);
if (dailyRowsEnd === -1) throw new Error("ManagerReports: daily service rows closing anchor not found.");
const dailyRowsArgsStart = dailyRowsIndex + dailyRowsStart.length;
const dailyRowsArgs = source.slice(dailyRowsArgsStart, dailyRowsEnd);
const firstComma = dailyRowsArgs.indexOf(',');
if (firstComma === -1) throw new Error("ManagerReports: daily service rows arguments could not be parsed.");
const firstArg = dailyRowsArgs.slice(0, firstComma).trim();
const restArgs = dailyRowsArgs.slice(firstComma);
if (!firstArg.includes('.filter(s => getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay)')) source = source.slice(0, dailyRowsArgsStart) + `${firstArg}.filter(s => getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay)${restArgs}` + source.slice(dailyRowsEnd);

const sectionStart = '<section className="service-report bg-white text-black rounded-none border shadow-sm print:border-0 print:shadow-none" dir="rtl">';
const wrappedSectionStart = '<section className="service-report bg-white text-black rounded-none border shadow-sm print:border-0 print:shadow-none" dir="rtl"><div className="print:hidden">';
if (source.includes(sectionStart) && !source.includes(wrappedSectionStart)) source = source.replace(sectionStart, wrappedSectionStart);
if (!source.includes(wrappedSectionStart)) throw new Error("ManagerReports: daily service report section anchor not found.");

const printBlock = `<div className="daily-print-report" dir="rtl">
        <header className="daily-print-header">
          {settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="daily-print-logo" />}
          <div className="daily-print-company">{settings.brandName || "HADIR"}</div>
          <div className="daily-print-title">سجل الحضور والانصراف ليوم {days[dateOf(date).getDay()]} {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div>
        </header>
        <table className="daily-print-table">
          <colgroup><col className="daily-print-no" /><col className="daily-print-specialty" /><col className="daily-print-name" /><col className="daily-print-status" /><col className="daily-print-time" /><col className="daily-print-time" /><col className="daily-print-note" /></colgroup>
          <thead><tr><th>ت</th><th>الاختصاص</th><th>اسم الموظف</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th><th>ملاحظات</th></tr></thead>
          <tbody>{dailyServiceRows.map((row, i) => <tr key={row.employee.id}><td className="daily-print-center">{i + 1}</td><td>{specialtyOf(row.employee)}</td><td className="daily-print-name-cell">{row.employee.name}</td><td className="daily-print-center"><span className={"daily-print-status " + String(row.status)}>{labels[row.status]}</span></td><td className="daily-print-center">{row.checkIn}</td><td className="daily-print-center">{row.checkOut}</td><td>{row.note || "—"}</td></tr>)}</tbody>
        </table>
      </div>`;
const dailySectionEnd = '</div>\n    </section> : <div className="hud-card';
if (!source.includes('className="daily-print-report"')) {
  if (!source.includes(dailySectionEnd)) throw new Error("ManagerReports: daily service report closing anchor not found.");
  source = source.replace(dailySectionEnd, `</div>${printBlock}\n    </section> : <div className="hud-card`);
}
if (!source.includes('className="daily-print-report"')) throw new Error("ManagerReports: dedicated daily print report was not inserted.");

const oldPageCss = "@page { size: A4 landscape; margin: 5mm 6mm; }";
const newPageCss = "@page { size: A4 portrait; margin: 8mm 7mm; }";
if (source.includes(oldPageCss)) source = source.replace(oldPageCss, newPageCss);
else if (!source.includes(newPageCss)) throw new Error("ManagerReports: inline print page rule not found.");

const oldLogoCss = ".service-report img { max-height: 10mm !important; }";
const newLogoCss = ".service-report img { width: 31mm !important; height: 31mm !important; max-width: 31mm !important; max-height: 31mm !important; object-fit: contain !important; }";
if (source.includes(oldLogoCss)) source = source.replace(oldLogoCss, newLogoCss);

const oldPrintCssMarker = '.service-report .bg-slate-100 { background: #f1f5f9 !important;';
const printCss = `.daily-print-report { display: none; }\n.daily-print-status { display: inline-block; border-radius: 999px; padding: 1.2mm 3mm; font-weight: 800; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n.daily-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; }\n.daily-print-table th, .daily-print-table td { border: 0.25mm solid #111; padding: 2mm 1.5mm; vertical-align: middle; overflow-wrap: anywhere; }\n.daily-print-table th { font-weight: 900; background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n.daily-print-center { text-align: center; }\n.daily-print-name-cell { font-weight: 800; }\n.daily-print-no { width: 6%; }\n.daily-print-specialty { width: 17%; }\n.daily-print-name { width: 20%; }\n.daily-print-status { width: 13%; }\n.daily-print-time { width: 10%; }\n.daily-print-note { width: 24%; }\n`;
if (!source.includes('daily-print-table {')) {
  if (!source.includes(oldPrintCssMarker)) throw new Error("ManagerReports: print CSS insertion anchor not found.");
  source = source.replace(oldPrintCssMarker, printCss + oldPrintCssMarker);
}

const printMediaOld = ' .service-report { position: static !important; width: 100% !important; max-width: none !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; overflow: visible !important; display: block !important; }';
const printMediaNew = ' .service-report { position: static !important; width: 100% !important; max-width: none !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; overflow: visible !important; display: block !important; } .service-report > .print\\:hidden { display: none !important; } .daily-print-report { display: block !important; width: 100% !important; font-size: 9pt !important; color: #000 !important; } .daily-print-header { text-align: center; padding: 0 0 6mm; border-bottom: 0.5mm solid #111; margin-bottom: 5mm; break-inside: avoid; page-break-inside: avoid; } .daily-print-logo { display: block; width: 31mm !important; height: 31mm !important; max-width: 31mm !important; max-height: 31mm !important; object-fit: contain !important; margin: 0 auto 2mm; } .daily-print-company { font-size: 18pt; font-weight: 900; margin-bottom: 2mm; } .daily-print-title { font-size: 12pt; font-weight: 900; } .daily-print-table thead { display: table-header-group !important; } .daily-print-table tbody { display: table-row-group !important; } .daily-print-table tr { break-inside: avoid !important; page-break-inside: avoid !important; } .daily-print-table td, .daily-print-table th { line-height: 1.35 !important; }';
if (!source.includes('.daily-print-report { display: block !important;')) {
  if (!source.includes(printMediaOld)) throw new Error("ManagerReports: print media layout anchor not found.");
  source = source.replace(printMediaOld, printMediaNew);
}

if (!source.includes('const [reportSettings, setReportSettings]')) throw new Error("ManagerReports: settings hydration was not applied.");
if (!source.includes('getBackendSettings')) throw new Error("ManagerReports: backend settings hydration import was not applied.");
if (!source.includes('className="h-[3.1cm] w-[3.1cm]')) throw new Error("ManagerReports: 3.1cm logo markup was not applied.");
if (!source.includes(newPageCss)) throw new Error("ManagerReports: A4 portrait print rule was not applied.");
if (!source.includes('getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay')) throw new Error("ManagerReports: daily scheduled-employee filter was not applied.");
if (!source.includes('className="daily-print-report"')) throw new Error("ManagerReports: dedicated print report was not applied.");
if (!source.includes('سجل الحضور والانصراف ليوم')) throw new Error("ManagerReports: daily print title was not applied.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports header/print patch applied idempotently.");