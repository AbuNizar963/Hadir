import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";';
const shareImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer, Share2 } from "lucide-react";';
if (source.includes(iconImport)) source = source.replace(iconImport, shareImport);
else if (!source.includes("Share2")) throw new Error("ManagerReports share patch: lucide import anchor not found.");

const pdfImport = 'import { generateProfessionalReportPdf } from "@/lib/professionalPdf";';
if (!source.includes(pdfImport)) {
  const backendImportMatch = source.match(/^import .*getBackendAudit.*$/m);
  if (!backendImportMatch) throw new Error("ManagerReports share patch: backend import anchor not found.");
  source = source.replace(backendImportMatch[0], `${backendImportMatch[0]}\n${pdfImport}`);
}

if (!source.includes("sharingPdf")) {
  const modeStateMatch = source.match(/^  const \[mode, setMode\] = useState<Mode>\("monthly"\).*$/m);
  if (!modeStateMatch) throw new Error("ManagerReports share patch: mode state anchor not found.");
  source = source.replace(modeStateMatch[0], `${modeStateMatch[0]}\n  const [sharingPdf, setSharingPdf] = useState(false);\n  const [readyPdf, setReadyPdf] = useState<File | null>(null);`);
}

if (!source.includes('const sharePdf = async')) {
  const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n\n    // Web Share must be invoked directly from a user gesture. The PDF itself\n    // is generated asynchronously, so the first click prepares it and the\n    // button becomes a second, explicit user gesture for the native share UI.\n    if (readyPdf) {\n      // File.name is the authoritative filename for file sharing. Android\n      // share targets can ignore ShareData.title or replace a preview title,\n      // so send only the File and keep the exact agreed filename on it.\n      const shareData = { files: [readyPdf] };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [readyPdf] }))) {\n        try {\n          await navigator.share(shareData);\n        } catch (error) {\n          if ((error as DOMException)?.name !== "AbortError") {\n            console.error("تعذر مشاركة PDF:", error);\n            window.alert(error instanceof Error ? error.message : "تعذر مشاركة ملف PDF");\n          }\n        }\n      } else {\n        const url = URL.createObjectURL(readyPdf);\n        const anchor = document.createElement("a");\n        anchor.href = url; anchor.download = readyPdf.name;\n        document.body.appendChild(anchor); anchor.click(); anchor.remove();\n        window.setTimeout(() => URL.revokeObjectURL(url), 1000);\n      }\n      return;\n    }\n\n    const report = document.querySelector<HTMLElement>(".service-report");\n    if (!report) { window.alert("تعذر العثور على محتوى التقرير"); return; }\n    try {\n      setSharingPdf(true);\n      setReadyPdf(null);\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n\n      const clone = report.cloneNode(true) as HTMLElement;\n      clone.querySelectorAll<HTMLElement>("[data-hadir-pdf-exclude]").forEach(node => node.remove());\n\n      const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))\n        .map(link => link.href)\n        .filter(Boolean)\n        .map(href => '<link rel="stylesheet" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">')\n        .join("");\n      const inlineStyles = Array.from(document.querySelectorAll("style"))\n        .map(style => style.textContent || "")\n        .join("\\n");\n      const printCssUrl = new URL("/report-print.css", window.location.origin).href;\n      const documentHtml = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>سجل الحضور والغياب</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">' + stylesheetLinks + '<link rel="stylesheet" href="' + printCssUrl + '"><style>' + inlineStyles + '</style></head><body dir="rtl"><main>' + clone.outerHTML + '</main></body></html>';\n      let printCss = "";\n      try { printCss = await fetch(printCssUrl, { cache: "no-store" }).then(response => response.ok ? response.text() : ""); } catch { /* The stylesheet is already linked in the HTML. */ }\n\n      const companyName = String(settings.brandName || "الشركة").trim().replace(/[\\/:*?"<>|]/g, "-") || "الشركة";\n      const reportDate = date;\n      const reportDay = days[dateOf(reportDate).getDay()];\n      const dayNumber = String(dateOf(reportDate).getDate());\n      const monthNumber = String(dateOf(reportDate).getMonth() + 1);\n      const yearNumber = String(dateOf(reportDate).getFullYear());\n      const displayDate = dayNumber + "/" + monthNumber + "/" + yearNumber;\n      const filename = companyName + " - سجل الحضور والغياب - ليوم " + reportDay + " - تاريخ " + displayDate + ".pdf";\n      const blob = await generateProfessionalReportPdf(documentHtml, printCss, filename);\n      setReadyPdf(new File([blob], filename, { type: "application/pdf" }));\n    } catch (error) {\n      console.error("تعذر إنشاء PDF:", error);\n      window.alert(error instanceof Error ? error.message : "تعذر تجهيز ملف PDF");\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n`;
  const titleAnchor = '  const title = ';
  if (!source.includes(titleAnchor)) throw new Error("ManagerReports share patch: title anchor not found.");
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf} data-hadir-share="true"><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري إنشاء PDF…" : readyPdf ? "مشاركة PDF الآن" : "تجهيز PDF للمشاركة"}</Button>';
const csvButton = '<Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>';
const dailyCsvReplacement = `{mode === "daily" ? ${shareButton} : ${csvButton}}`;

if (!source.includes(dailyCsvReplacement)) {
  if (!source.includes(csvButton)) throw new Error("ManagerReports share patch: exact CSV JSX anchor not found; refusing unsafe replacement.");
  source = source.replace(csvButton, dailyCsvReplacement);
}

const hasRenderedShareControl = source.includes('data-hadir-share="true"') && source.includes('onClick={sharePdf}') && source.includes("مشاركة PDF الآن") && source.includes('mode === "daily" ?');
const hasRenderedPrintControl = source.includes('onClick={printReport}') && source.includes("طباعة الخدمة");
if (!source.includes('from "@/lib/professionalPdf"') || !source.includes('const sharePdf = async') || !source.includes('readyPdf') || !source.includes('sharingPdf') || !source.includes('سجل الحضور والغياب - ليوم') || !hasRenderedShareControl || !hasRenderedPrintControl) {
  throw new Error(`ManagerReports share patch: PDF sharing, R2 logo pipeline, filename and print buttons were not all applied completely (share=${hasRenderedShareControl}, print=${hasRenderedPrintControl}).`);
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily PDF is shared as a File with the requested Arabic filename; native share payload contains files only so Android targets cannot replace the file name with the share title; monthly and annual CSV preserved.");
