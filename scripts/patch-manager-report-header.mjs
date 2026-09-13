import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

if (!source.includes("getBackendSettings")) {
  const backendImport = /import\s*\{([\s\S]*?)\}\s*from\s*["']@\/lib\/backend["'];/;
  const match = source.match(backendImport);
  if (!match) {
    throw new Error("ManagerReports: backend import declaration not found.");
  }
  const names = match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.includes("getBackendSettings")) names.push("getBackendSettings");
  const replacement = `import {\n  ${names.join(",\n  ")},\n} from "@/lib/backend";`;
  source = source.replace(backendImport, replacement);
}

const settingsPattern = /const settings = getSettings\(\);/;
if (settingsPattern.test(source)) {
  const hydratedSettings = `const [reportSettings, setReportSettings] = useState(() => getSettings());
  const settings = reportSettings;
  useEffect(() => {
    let alive = true;
    const loadReportSettings = async () => {
      try {
        const remote = await getBackendSettings();
        if (!alive || !remote) return;
        setReportSettings((current) => ({
          ...current,
          ...remote,
          adminAccounts: Array.isArray(remote.adminAccounts)
            ? remote.adminAccounts
            : current.adminAccounts,
        }));
      } catch (error) {
        console.warn("تعذر تحميل إعدادات التقرير من D1:", error);
      }
    };
    void loadReportSettings();
    const onSettingsChanged = () => {
      setReportSettings(getSettings());
      void loadReportSettings();
    };
    window.addEventListener("hadir:cloud-data-changed", onSettingsChanged);
    window.addEventListener("hadir:d1-view-changed", onSettingsChanged);
    return () => {
      alive = false;
      window.removeEventListener("hadir:cloud-data-changed", onSettingsChanged);
      window.removeEventListener("hadir:d1-view-changed", onSettingsChanged);
    };
  }, []);`;
  source = source.replace(settingsPattern, hydratedSettings);
} else if (!source.includes("const [reportSettings, setReportSettings]")) {
  throw new Error("ManagerReports: settings state anchor not found.");
}

const currentHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>`;
const legacyHeaderBlock = `${currentHeaderBlock}\n        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold"><div>رئيس القسم : {settings.ownerName || "—"}</div><div>معاون رئيس القسم : {settings.managerName || "—"}</div></div>`;
const newHeaderBlock = `<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-[3.1cm] w-[3.1cm] object-contain shrink-0" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">سجل الحضور والغياب ليوم {days[dateOf(date).getDay()]} {String(dateOf(date).getDate()).padStart(2, "0")}/{String(dateOf(date).getMonth() + 1).padStart(2, "0")}/{dateOf(date).getFullYear()}</div></div>`;
if (source.includes(legacyHeaderBlock)) source = source.replace(legacyHeaderBlock, newHeaderBlock);
else if (source.includes(currentHeaderBlock)) source = source.replace(currentHeaderBlock, newHeaderBlock);
else if (!source.includes(newHeaderBlock)) throw new Error("ManagerReports: daily report header block not found.");

const oldEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}<div className="font-normal text-[10px] mt-0.5">{row.employee.jobNumber}</div></td>`;
const newEmployeeCell = `<td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}</td>`;
if (source.includes(oldEmployeeCell)) source = source.replace(oldEmployeeCell, newEmployeeCell);

const dailyRowsStart = /const dailyServiceRows = useMemo\(\(\) => mode === "daily" \? serviceRows\(/;
const dailyRowsMatch = source.match(dailyRowsStart);
if (!dailyRowsMatch || dailyRowsMatch.index === undefined) {
  throw new Error("ManagerReports: daily service rows declaration not found.");
}
const dailyRowsArgsStart = dailyRowsMatch.index + dailyRowsMatch[0].length;
const dailyRowsEnd = source.indexOf(") : [],", dailyRowsArgsStart);
if (dailyRowsEnd === -1) throw new Error("ManagerReports: daily service rows closing anchor not found.");
const dailyRowsArgs = source.slice(dailyRowsArgsStart, dailyRowsEnd);
const firstComma = dailyRowsArgs.indexOf(",");
if (firstComma === -1) throw new Error("ManagerReports: daily service rows arguments could not be parsed.");
const firstArg = dailyRowsArgs.slice(0, firstComma).trim();
const restArgs = dailyRowsArgs.slice(firstComma);
if (!firstArg.includes(".filter((s) => getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay)")) {
  source =
    source.slice(0, dailyRowsArgsStart) +
    `${firstArg}.filter((s) => getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay)${restArgs}` +
    source.slice(dailyRowsEnd);
}

const sectionStart = /<section\s+className=["']service-report\b[^"']*["'][^>]*>/;
const sectionMatch = source.match(sectionStart);
if (!sectionMatch || sectionMatch.index === undefined) {
  throw new Error("ManagerReports: daily service report section anchor not found.");
}
const sectionOpening = sectionMatch[0];
const wrappedSectionStart = `${sectionOpening}<div className="print:hidden">`;
if (!source.includes('className="daily-print-report"') && !source.includes(wrappedSectionStart)) {
  source = source.replace(sectionOpening, wrappedSectionStart);
}

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
if (!source.includes('className="daily-print-report"')) {
  const closingPattern = /<\/div>\s*<\/section>\s*:\s*<section className="space-y-4">/;
  if (!closingPattern.test(source)) throw new Error("ManagerReports: daily service report closing anchor not found.");
  source = source.replace(closingPattern, `</div>${printBlock}\n    </section> : <section className="space-y-4">`);
}

const oldPageCss = "@page { size: A4 landscape; margin: 5mm 6mm; }";
const newPageCss = "@page { size: A4 portrait; margin: 8mm 7mm; }";
if (source.includes(oldPageCss)) source = source.replace(oldPageCss, newPageCss);
else if (!source.includes(newPageCss)) {
  const pageRule = /@page\s*\{[^}]*\}/;
  if (pageRule.test(source)) source = source.replace(pageRule, newPageCss);
  else console.log("ManagerReports header patch: inline @page rule absent; external print CSS remains authoritative.");
}

if (!source.includes("const [reportSettings, setReportSettings]")) throw new Error("ManagerReports: settings hydration was not applied.");
if (!source.includes("getBackendSettings")) throw new Error("ManagerReports: backend settings hydration import was not applied.");
if (!source.includes('className="h-[3.1cm] w-[3.1cm]')) throw new Error("ManagerReports: 3.1cm logo markup was not applied.");
if (!source.includes('getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay')) throw new Error("ManagerReports: daily scheduled-employee filter was not applied.");
if (!source.includes('className="daily-print-report"')) throw new Error("ManagerReports: dedicated daily print report was not applied.");
if (!source.includes('سجل الحضور والانصراف ليوم')) throw new Error("ManagerReports: daily print title was not applied.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports header/print patch applied idempotently.");
