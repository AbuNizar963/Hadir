import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";';
const shareImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer, Share2 } from "lucide-react";';
if (source.includes(iconImport)) source = source.replace(iconImport, shareImport);
else if (!source.includes("Share2")) throw new Error("ManagerReports share patch: lucide import anchor not found.");

if (!source.includes("sharingPdf")) {
  const modeState = '  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));';
  if (!source.includes(modeState)) throw new Error("ManagerReports share patch: mode state anchor not found.");
  source = source.replace(modeState, `${modeState}\n  const [sharingPdf, setSharingPdf] = useState(false);`);
}

if (!source.includes('const sharePdf = async')) {
  const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n    try {\n      setSharingPdf(true);\n      // Use Chromium/Safari's native print engine instead of rasterizing the\n      // report with html2canvas. This preserves Arabic shaping, RTL direction,\n      // real table pagination, repeated table headers, and print CSS exactly\n      // like the existing "طباعة الخدمة" action. The browser print dialog can\n      // then save the result as a PDF or share it on mobile.\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n      window.print();\n    } catch (error) {\n      console.error("تعذر فتح تصدير PDF عبر الطباعة:", error);\n      window.alert("تعذر فتح نافذة الطباعة / حفظ PDF");\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n`;
  const titleAnchor = '  const title = ';
  if (!source.includes(titleAnchor)) throw new Error("ManagerReports share patch: title anchor not found.");
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf} data-hadir-share="true"><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري فتح الطباعة…" : "طباعة / حفظ PDF"}</Button>';
const csvButton = '<Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>';
const dailyCsvReplacement = `{mode === "daily" ? ${shareButton} : ${csvButton}}`;

// Daily reports use the browser's print/PDF pipeline; monthly and annual CSV
// export remains unchanged. Refuse the patch if the exact existing CSV control
// cannot be found, so this build script never performs a broad unsafe replacement.
if (!source.includes(dailyCsvReplacement)) {
  if (!source.includes(csvButton)) {
    throw new Error("ManagerReports share patch: exact CSV JSX anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(csvButton, dailyCsvReplacement);
}

// Earlier report patches changed the surrounding JSX wrapper over time. Validate
// the actual control expressions instead of depending on one historical wrapper.
const hasRenderedShareControl = source.includes('data-hadir-share="true"') && source.includes('onClick={sharePdf}') && source.includes("طباعة / حفظ PDF") && source.includes('mode === "daily" ?');
const hasRenderedPrintControl = source.includes('onClick={printReport}') && source.includes("طباعة الخدمة");
if (!source.includes('const sharePdf = async') || !source.includes('sharingPdf') || !hasRenderedShareControl || !hasRenderedPrintControl) {
  throw new Error(`ManagerReports share patch: PDF/print controls were not both applied completely (share=${hasRenderedShareControl}, print=${hasRenderedPrintControl}).`);
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily PDF export now uses the native browser print engine for professional RTL/Arabic pagination; monthly and annual CSV preserved.");
