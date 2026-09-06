import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ProfessionalAttendanceReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { BarChart3, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, Users } from "lucide-react";';
const shareIconImport = 'import { BarChart3, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, Users, Share2 } from "lucide-react";';
if (source.includes(iconImport)) source = source.replace(iconImport, shareIconImport);
else if (!source.includes("Share2")) throw new Error("Professional report share patch: icon import anchor not found.");

const pdfImport = 'import { generateProfessionalReportPdf, pdfBlobToFile } from "@/lib/professionalPdf";';
if (!source.includes(pdfImport)) {
  const exportImport = 'import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";';
  if (!source.includes(exportImport)) throw new Error("Professional report share patch: export import anchor not found.");
  source = source.replace(exportImport, `${exportImport}\n${pdfImport}`);
}

if (!source.includes("sharingPdf")) {
  const settingsAnchor = '  const settings = getSettings();';
  if (!source.includes(settingsAnchor)) throw new Error("Professional report share patch: settings anchor not found.");
  source = source.replace(settingsAnchor, `${settingsAnchor}\n  const [sharingPdf, setSharingPdf] = useState(false);\n  const [readyPdf, setReadyPdf] = useState<File | null>(null);`);
}

if (!source.includes("const sharePdf = async")) {
  const printAnchor = '  const printReport = () => window.print();';
  if (!source.includes(printAnchor)) throw new Error("Professional report share patch: print anchor not found.");
  const shareFunction = `  const sharePdf = async () => {\n    if (!report) return;\n\n    if (readyPdf) {\n      const shareData = { files: [readyPdf] };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [readyPdf] }))) {\n        try { await navigator.share(shareData); } catch (error) {\n          if ((error as DOMException)?.name !== "AbortError") window.alert(error instanceof Error ? error.message : "تعذر مشاركة ملف PDF");\n        }\n      } else {\n        const url = URL.createObjectURL(readyPdf);\n        const anchor = document.createElement("a");\n        anchor.href = url; anchor.download = readyPdf.name;\n        document.body.appendChild(anchor); anchor.click(); anchor.remove();\n        window.setTimeout(() => URL.revokeObjectURL(url), 1000);\n      }\n      return;\n    }\n\n    const reportElement = document.querySelector<HTMLElement>(".professional-attendance-report");\n    if (!reportElement) { window.alert("تعذر العثور على محتوى التقرير"); return; }\n    try {\n      setSharingPdf(true);\n      setReadyPdf(null);\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n      const clone = reportElement.cloneNode(true) as HTMLElement;\n      clone.querySelectorAll<HTMLElement>("[data-hadir-pdf-exclude]").forEach(node => node.remove());\n      const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))\n        .map(link => link.href).filter(Boolean)\n        .map(href => '<link rel="stylesheet" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">').join("");\n      const inlineStyles = Array.from(document.querySelectorAll("style")).map(style => style.textContent || "").join("\\n");\n      const printCssUrl = new URL("/report-print.css", window.location.origin).href;\n      const documentHtml = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>تقرير الحضور</title>' + stylesheetLinks + '<link rel="stylesheet" href="' + printCssUrl + '"><style>' + inlineStyles + '</style></head><body dir="rtl"><main>' + clone.outerHTML + '</main></body></html>';\n      let printCss = "";\n      try { printCss = await fetch(printCssUrl, { cache: "no-store" }).then(response => response.ok ? response.text() : ""); } catch { /* linked stylesheet remains available */ }\n      const companyName = String(settings.brandName || "الشركة").trim().replace(/[\\/:*?"<>|]/g, "-") || "الشركة";\n      const filename = companyName + " - تقرير الحضور - " + report.from + " إلى " + report.to + ".pdf";\n      const blob = await generateProfessionalReportPdf(documentHtml, printCss, filename);\n      setReadyPdf(pdfBlobToFile(blob, filename));\n    } catch (error) {\n      console.error("تعذر إنشاء PDF:", error);\n      window.alert(error instanceof Error ? error.message : "تعذر تجهيز ملف PDF");\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n\n`;
  source = source.replace(printAnchor, `${shareFunction}${printAnchor}`);
}

const oldButton = '<Button onClick={printReport} disabled={!report}><FileText className="ml-2 h-4 w-4" />PDF / طباعة</Button>';
const newButtons = '<Button onClick={sharePdf} disabled={!report || sharingPdf}><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري تجهيز PDF…" : readyPdf ? "مشاركة PDF الآن" : "مشاركة PDF"}</Button><Button variant="outline" onClick={printReport} disabled={!report}><FileText className="ml-2 h-4 w-4" />طباعة</Button>';
if (source.includes(oldButton)) source = source.replace(oldButton, newButtons);
else if (!source.includes('onClick={sharePdf}')) throw new Error("Professional report share patch: PDF button anchor not found; refusing unsafe replacement.");

const rootAnchor = '<div dir="rtl" className="space-y-5 pb-10 print:bg-white">';
const rootReplacement = '<div dir="rtl" className="professional-attendance-report space-y-5 pb-10 print:bg-white">';
if (source.includes(rootAnchor)) source = source.replace(rootAnchor, rootReplacement);

if (!source.includes('from "@/lib/professionalPdf"') || !source.includes("const sharePdf = async") || !source.includes("sharingPdf") || !source.includes('onClick={sharePdf}') || !source.includes("professional-attendance-report")) {
  throw new Error("Professional report share patch: direct PDF sharing was not applied completely.");
}

writeFileSync(file, source, "utf8");
console.log("ProfessionalAttendanceReports share patch: direct PDF generation and native file sharing enabled; print remains available separately.");
