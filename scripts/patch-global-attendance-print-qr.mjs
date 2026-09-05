import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/GlobalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const storageImport = 'import { getEmployees, getSettings } from "@/lib/storage";';
if (!source.includes(storageImport)) throw new Error("GlobalAttendanceReports QR: storage import anchor not found.");
source = source.replace(storageImport, 'import { getEmployees, getSettings, getManagerSession } from "@/lib/storage";');
if (!source.includes('import { QRCodeSVG } from "qrcode.react";')) {
  const lucideImport = 'import { BarChart3, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, Users } from "lucide-react";';
  if (!source.includes(lucideImport)) throw new Error("GlobalAttendanceReports QR: icon import anchor not found.");
  source = source.replace(lucideImport, lucideImport + '\nimport { QRCodeSVG } from "qrcode.react";');
}

const stateAnchor = '  const [detailError, setDetailError] = useState<string | null>(null);';
if (!source.includes('const [printGeneratedAt, setPrintGeneratedAt]')) {
  if (!source.includes(stateAnchor)) throw new Error("GlobalAttendanceReports QR: state anchor not found.");
  source = source.replace(stateAnchor, stateAnchor + '\n  const [printGeneratedAt, setPrintGeneratedAt] = useState(() => new Date().toISOString());');
}

const printFunctionAnchor = '  const printDailyReport = () => { if (!report || report.days !== 1) { window.print(); return; } window.requestAnimationFrame(() => window.print()); };';
const printFunctionReplacement = '  const printDailyReport = () => { if (!report || report.days !== 1) { window.print(); return; } setPrintGeneratedAt(new Date().toISOString()); window.requestAnimationFrame(() => window.print()); };';
if (source.includes(printFunctionAnchor)) source = source.replace(printFunctionAnchor, printFunctionReplacement);

const headerAnchor = '      <header className="global-attendance-print-header">';
if (!source.includes(headerAnchor)) throw new Error("GlobalAttendanceReports QR: print header anchor not found.");
if (!source.includes('className="global-attendance-print-qr"')) {
  const qr = `      <header className="global-attendance-print-header">\n        {(() => {\n          const session = getManagerSession();\n          const role = session?.role === "owner" ? "مالك" : session?.role === "manager" ? "مدير" : "غير محدد";\n          const issuerName = session?.name || (session?.role === "owner" ? reportSettings.ownerName : session?.role === "manager" ? reportSettings.managerName : "") || "غير محدد";\n          const qrValue = JSON.stringify({ reportDate: report.from, extractedAt: printGeneratedAt, extractedAtDamascus: new Date(printGeneratedAt).toLocaleString("ar", { timeZone: "Asia/Damascus", dateStyle: "medium", timeStyle: "medium" }), extractedBy: issuerName, role });\n          return <div className="global-attendance-print-qr"><QRCodeSVG value={qrValue} size={128} level="H" includeMargin /></div>;\n        })()}`;
  source = source.replace(headerAnchor, qr);
}

const headerCssAnchor = '        .global-attendance-print-header { text-align: center; margin: 0 0 7mm; break-inside: avoid; page-break-inside: avoid; }';
if (source.includes(headerCssAnchor)) {
  const oldQrCss = '        .global-attendance-print-header { position: relative; }\n        .global-attendance-print-qr { position: absolute; top: 0; right: 0; width: 28mm; height: 28mm; }\n        .global-attendance-print-qr svg { display: block; width: 28mm !important; height: 28mm !important; }';
  const newQrCss = '        .global-attendance-print-header { position: relative; min-height: 30mm; }\n        .global-attendance-print-qr { position: absolute; top: 0; left: 0; width: 30mm; height: 30mm; display: flex; align-items: flex-start; justify-content: flex-start; }\n        .global-attendance-print-qr svg { display: block; width: 30mm !important; height: 30mm !important; }';
  if (source.includes(oldQrCss)) source = source.replace(oldQrCss, newQrCss);
  else if (!source.includes('.global-attendance-print-qr {')) source = source.replace(headerCssAnchor, headerCssAnchor + '\n' + newQrCss);
}

writeFileSync(file, source, "utf8");
console.log("GlobalAttendanceReports print QR patch: professional top-left QR, 30mm, high error correction, with report date, extraction time, extractor name, and role.");
