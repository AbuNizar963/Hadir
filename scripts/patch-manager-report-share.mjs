import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";';
const shareImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer, Share2 } from "lucide-react";';
if (source.includes(iconImport)) source = source.replace(iconImport, shareImport);
else if (!source.includes("Share2")) throw new Error("ManagerReports share patch: lucide import anchor not found.");

const backendImport = 'import { getBackendAudit, getBackendEmployees, getBackendRequests } from "@/lib/backend";';
const pdfImport = 'import { generateProfessionalReportPdf } from "@/lib/professionalPdf";';
if (!source.includes(pdfImport)) {
  if (!source.includes(backendImport)) throw new Error("ManagerReports share patch: backend import anchor not found.");
  source = source.replace(backendImport, `${backendImport}\n${pdfImport}`);
}

if (!source.includes("sharingPdf")) {
  const modeState = '  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));';
  if (!source.includes(modeState)) throw new Error("ManagerReports share patch: mode state anchor not found.");
  source = source.replace(modeState, `${modeState}\n  const [sharingPdf, setSharingPdf] = useState(false);`);
}

if (!source.includes('const sharePdf = async')) {
  const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n    const report = document.querySelector<HTMLElement>(".service-report");\n    if (!report) { window.alert("تعذر العثور على محتوى التقرير"); return; }\n    try {\n      setSharingPdf(true);\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n\n      // Send the real report DOM and the same stylesheets used by the page to\n      // the server-side Chromium PDF renderer. No canvas rasterization or\n      // manual pixel slicing is used, so Arabic shaping and print pagination\n      // remain native browser layout.\n      const clone = report.cloneNode(true) as HTMLElement;\n      clone.querySelectorAll<HTMLElement>("[data-hadir-pdf-exclude]").forEach(node => node.remove());\n      const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))\n        .map(link => link.href)\n        .filter(Boolean)\n        .map(href => `<link rel="stylesheet" href="${href.replace(/&/g, "&amp;").replace(/\\"/g, "&quot;")}">`)\n        .join("");\n      const inlineStyles = Array.from(document.querySelectorAll("style"))\n        .map(style => style.textContent || "")\n        .join("\\n");\n      const printCssUrl = new URL("/report-print.css", window.location.origin).href;\n      const documentHtml = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>تقرير خدمة الدوام</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">${stylesheetLinks}<link rel="stylesheet" href="${printCssUrl}"><style>${inlineStyles}</style></head><body dir="rtl"><main>${clone.outerHTML}</main></body></html>`;\n      let printCss = "";\n      try { printCss = await fetch(printCssUrl, { cache: "no-store" }).then(response => response.ok ? response.text() : ""); } catch { /* The stylesheet is already linked in the HTML. */ }\n\n      const filename = \`Hadir-خدمة-\${date}.pdf\`;\n      const blob = await generateProfessionalReportPdf(documentHtml, printCss, filename);\n      const file = new File([blob], filename, { type: "application/pdf" });\n      const shareData = { files: [file], title: \`خدمة الدوام · \${formatDate(date)}\`, text: \`تقرير خدمة الدوام ليوم \${formatDate(date)}\` };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {\n        await navigator.share(shareData);\n      } else {\n        const url = URL.createObjectURL(blob);\n        const anchor = document.createElement("a");\n        anchor.href = url; anchor.download = filename;\n        document.body.appendChild(anchor); anchor.click(); anchor.remove();\n        window.setTimeout(() => URL.revokeObjectURL(url), 1000);\n      }\n    } catch (error) {\n      if ((error as DOMException)?.name !== "AbortError") {\n        console.error("تعذر إنشاء أو مشاركة PDF للخدمة:", error);\n        window.alert(error instanceof Error ? error.message : "تعذر تجهيز ملف PDF");\n      }\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n`;
  const titleAnchor = '  const title = ';
  if (!source.includes(titleAnchor)) throw new Error("ManagerReports share patch: title anchor not found.");
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf} data-hadir-share="true"><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري إنشاء PDF…" : "مشاركة PDF"}</Button>';
const csvButton = '<Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>';
const dailyCsvReplacement = `{mode === "daily" ? ${shareButton} : ${csvButton}}`;

if (!source.includes(dailyCsvReplacement)) {
  if (!source.includes(csvButton)) {
    throw new Error("ManagerReports share patch: exact CSV JSX anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(csvButton, dailyCsvReplacement);
}

const hasRenderedShareControl = source.includes('data-hadir-share="true"') && source.includes('onClick={sharePdf}') && source.includes("مشاركة PDF") && source.includes('mode === "daily" ?');
const hasRenderedPrintControl = source.includes('onClick={printReport}') && source.includes("طباعة الخدمة");
if (!source.includes('from "@/lib/professionalPdf"') || !source.includes('const sharePdf = async') || !source.includes('sharingPdf') || !hasRenderedShareControl || !hasRenderedPrintControl) {
  throw new Error(`ManagerReports share patch: PDF sharing and print buttons were not both applied completely (share=${hasRenderedShareControl}, print=${hasRenderedPrintControl}).`);
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily PDF sharing now uses server-side Chromium with the live report HTML/CSS; native print remains a separate action; monthly and annual CSV preserved.");
