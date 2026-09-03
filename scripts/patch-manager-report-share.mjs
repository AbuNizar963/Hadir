import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";';
const shareImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer, Share2 } from "lucide-react";';
if (source.includes(iconImport)) source = source.replace(iconImport, shareImport);
else if (!source.includes("Share2")) throw new Error("ManagerReports share patch: lucide import anchor not found.");

if (!source.includes('from "html2canvas"')) {
  const importAnchor = 'import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";';
  if (!source.includes(importAnchor)) throw new Error("ManagerReports share patch: report export import anchor not found.");
  source = source.replace(importAnchor, `${importAnchor}\nimport html2canvas from "html2canvas";\nimport { jsPDF } from "jspdf";`);
}

if (!source.includes("sharingPdf")) {
  const modeState = '  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));';
  if (!source.includes(modeState)) throw new Error("ManagerReports share patch: mode state anchor not found.");
  source = source.replace(modeState, `${modeState}\n  const [sharingPdf, setSharingPdf] = useState(false);`);
}

if (!source.includes('const sharePdf = async')) {
  const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n    const report = document.querySelector<HTMLElement>(".service-report");\n    if (!report) return;\n    let renderHost: HTMLDivElement | null = null;\n    try {\n      setSharingPdf(true);\n      // Do not refresh D1 here: the report already has the current daily snapshot,\n      // and blocking PDF generation on four network requests made the button look\n      // stuck on mobile. Live refresh remains part of the normal report lifecycle.\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n\n      // Render an isolated, fixed-width copy so mobile layout/overflow does not\n      // affect the A4 landscape canvas. The report contains pairs of groups;\n      // flatten every pair to one column so a group can never be split merely\n      // because its desktop two-column grid reached a page boundary.\n      renderHost = document.createElement("div");\n      renderHost.style.position = "fixed";\n      renderHost.style.left = "-100000px";\n      renderHost.style.top = "0";\n      renderHost.style.width = "1120px";\n      renderHost.style.background = "#ffffff";\n      renderHost.style.zIndex = "-1";\n      const clone = report.cloneNode(true) as HTMLElement;\n      clone.style.width = "1120px";\n      clone.style.maxWidth = "none";\n      clone.style.minHeight = "0";\n      clone.style.height = "auto";\n      clone.style.margin = "0";\n      clone.style.padding = "0";\n      clone.style.overflow = "visible";\n      clone.style.background = "#ffffff";\n      clone.querySelectorAll<HTMLElement>(".service-report > div:nth-child(2) > .grid").forEach(pair => {\n        pair.style.display = "block";\n        pair.style.width = "100%";\n      });\n      clone.querySelectorAll<HTMLElement>(".service-report > div:nth-child(2) > .grid > div").forEach(group => {\n        group.style.width = "100%";\n        group.style.margin = "0 0 12px";\n        group.style.breakInside = "avoid";\n        group.style.pageBreakInside = "avoid";\n      });\n      clone.querySelectorAll<HTMLElement>(".service-report table tr").forEach(row => {\n        row.style.breakInside = "avoid";\n        row.style.pageBreakInside = "avoid";\n      });\n      renderHost.appendChild(clone);\n      document.body.appendChild(renderHost);\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n\n      const renderTask = html2canvas(clone, { backgroundColor: "#ffffff", scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)), useCORS: true, logging: false, width: clone.scrollWidth, height: clone.scrollHeight, windowWidth: clone.scrollWidth, windowHeight: clone.scrollHeight });\n      const canvas = await Promise.race([renderTask, new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("انتهت مهلة تجهيز PDF")), 30000))]);\n      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });\n      const pageWidth = 297, pageHeight = 210, margin = 5, contentWidth = pageWidth - margin * 2, contentHeight = pageHeight - margin * 2;\n      const imageHeight = (canvas.height * contentWidth) / canvas.width;\n      const sourcePageHeight = Math.max(1, Math.floor((contentHeight / imageHeight) * canvas.height));\n\n      // Use the actual bottom edge of every complete specialty block as a legal\n      // page boundary. If no complete block fits in the remaining page, fall\n      // back to the A4 pixel boundary only for that single oversized block.\n      const cloneRect = clone.getBoundingClientRect();\n      const scaleX = canvas.width / Math.max(1, cloneRect.width);\n      const safeBreaks = Array.from(clone.querySelectorAll<HTMLElement>(".service-report > div:nth-child(2) > .grid > div"))\n        .map(group => Math.round((group.getBoundingClientRect().bottom - cloneRect.top) * scaleX))\n        .filter(value => value > 0 && value < canvas.height)\n        .sort((a, b) => a - b);\n\n      let sourceY = 0, page = 0;\n      while (sourceY < canvas.height) {\n        const targetY = Math.min(canvas.height, sourceY + sourcePageHeight);\n        const fittingBreaks = safeBreaks.filter(value => value > sourceY && value <= targetY);\n        const safeEnd = fittingBreaks.length ? fittingBreaks[fittingBreaks.length - 1] : targetY;\n        const sliceHeight = Math.max(1, Math.min(canvas.height - sourceY, safeEnd - sourceY));\n        const pageCanvas = document.createElement("canvas");\n        pageCanvas.width = canvas.width; pageCanvas.height = sliceHeight;\n        const ctx = pageCanvas.getContext("2d");\n        if (!ctx) throw new Error("تعذر تجهيز صفحة PDF");\n        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);\n        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);\n        if (page > 0) pdf.addPage();\n        const sliceMmHeight = (sliceHeight * contentWidth) / canvas.width;\n        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, contentWidth, Math.min(contentHeight, sliceMmHeight), undefined, "FAST");\n        sourceY += sliceHeight; page++;\n      }\n\n      const blob = pdf.output("blob");\n      const filename = \`Hadir-خدمة-\${date}.pdf\`;\n      const file = new File([blob], filename, { type: "application/pdf" });\n      const shareData = { files: [file], title: \`خدمة الدوام · \${formatDate(date)}\`, text: \`تقرير خدمة الدوام ليوم \${formatDate(date)}\` };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {\n        await navigator.share(shareData);\n      } else {\n        const url = URL.createObjectURL(blob);\n        const a = document.createElement("a"); a.href = url; a.download = filename;\n        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);\n      }\n    } catch (error) {\n      if ((error as DOMException)?.name !== "AbortError") {\n        console.error("تعذر إنشاء أو مشاركة PDF للخدمة:", error);\n        window.alert(error instanceof Error ? error.message : "تعذر تجهيز ملف PDF");\n      }\n    } finally {\n      if (renderHost) renderHost.remove();\n      setSharingPdf(false);\n    }\n  };\n`;
  const titleAnchor = '  const title = ';
  if (!source.includes(titleAnchor)) throw new Error("ManagerReports share patch: title anchor not found.");
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf} data-hadir-share="true"><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري تجهيز PDF…" : "مشاركة PDF"}</Button>';
const csvButton = '<Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>';
const dailyCsvReplacement = `{mode === "daily" ? ${shareButton} : ${csvButton}}`;

// Replace only the existing CSV action. Daily reports get PDF sharing in its place;
// monthly and annual reports keep their existing CSV export unchanged.
if (!source.includes(dailyCsvReplacement)) {
  if (!source.includes(csvButton)) {
    throw new Error("ManagerReports share patch: exact CSV JSX anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(csvButton, dailyCsvReplacement);
}

// The daily action controls live inside the report action container, whose exact
// wrapper has changed across earlier report patches. Validate the actual rendered
// control expressions rather than relying on one historical JSX wrapper shape.
const hasRenderedShareControl = source.includes('data-hadir-share="true"') && source.includes('onClick={sharePdf}') && source.includes("مشاركة PDF") && source.includes('mode === "daily" ?');
const hasRenderedPrintControl = source.includes('onClick={printReport}') && source.includes("طباعة الخدمة");
if (!source.includes('from "html2canvas"') || !source.includes('from "jspdf"') || !source.includes('const sharePdf = async') || !source.includes('sharingPdf') || !hasRenderedShareControl || !hasRenderedPrintControl) {
  throw new Error(`ManagerReports share patch: PDF sharing and print buttons were not both applied completely (share=${hasRenderedShareControl}, print=${hasRenderedPrintControl}).`);
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily CSV replaced by PDF sharing without blocking on a network refresh; PDF pages are flattened to one specialty block per row and break only at complete block boundaries; monthly and annual CSV preserved.");
