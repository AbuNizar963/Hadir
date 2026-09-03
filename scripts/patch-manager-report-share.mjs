import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const iconImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";';
const shareImport = 'import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer, Share2 } from "lucide-react";';
if (source.includes(iconImport)) {
  source = source.replace(iconImport, shareImport);
} else if (!source.includes("Share2")) {
  throw new Error("ManagerReports share patch: lucide import anchor not found.");
}

if (!source.includes('from "html2canvas"')) {
  const importAnchor = 'import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";';
  if (!source.includes(importAnchor)) throw new Error("ManagerReports share patch: report export import anchor not found.");
  source = source.replace(importAnchor, `${importAnchor}\nimport html2canvas from "html2canvas";\nimport { jsPDF } from "jspdf";`);
}

const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n    const report = document.querySelector<HTMLElement>(".service-report");\n    if (!report) return;\n    try {\n      setSharingPdf(true);\n      const fresh = await refreshDailyReportSnapshot();\n      if (!fresh) return;\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n      const canvas = await html2canvas(report, {\n        backgroundColor: "#ffffff",\n        scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)),\n        useCORS: true,\n        logging: false,\n        windowWidth: report.scrollWidth,\n        windowHeight: report.scrollHeight,\n      });\n      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });\n      const pageWidth = 297;\n      const pageHeight = 210;\n      const margin = 5;\n      const contentWidth = pageWidth - margin * 2;\n      const contentHeight = pageHeight - margin * 2;\n      const imageHeight = (canvas.height * contentWidth) / canvas.width;\n      const sourcePageHeight = Math.max(1, Math.floor((contentHeight / imageHeight) * canvas.height));\n      let sourceY = 0;\n      let page = 0;\n      while (sourceY < canvas.height) {\n        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);\n        const pageCanvas = document.createElement("canvas");\n        pageCanvas.width = canvas.width;\n        pageCanvas.height = sliceHeight;\n        const ctx = pageCanvas.getContext("2d");\n        if (!ctx) throw new Error("تعذر تجهيز صفحة PDF");\n        ctx.fillStyle = "#ffffff";\n        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);\n        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);\n        if (page > 0) pdf.addPage();\n        const sliceMmHeight = (sliceHeight * contentWidth) / canvas.width;\n        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, contentWidth, Math.min(contentHeight, sliceMmHeight), undefined, "FAST");\n        sourceY += sliceHeight;\n        page++;\n      }\n      const blob = pdf.output("blob");\n      const filename = \`Hadir-خدمة-\${date}.pdf\`;
      const file = new File([blob], filename, { type: "application/pdf" });\n      const shareData = { files: [file], title: \`خدمة الدوام · \${formatDate(date)}\`, text: \`تقرير خدمة الدوام ليوم \${formatDate(date)}\` };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {\n        await navigator.share(shareData);\n      } else {\n        const url = URL.createObjectURL(blob);\n        const a = document.createElement("a");\n        a.href = url;\n        a.download = filename;\n        document.body.appendChild(a);\n        a.click();\n        a.remove();\n        URL.revokeObjectURL(url);\n      }\n    } catch (error) {\n      if ((error as DOMException)?.name !== "AbortError") {\n        console.error("تعذر إنشاء أو مشاركة PDF للخدمة:", error);\n      }\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n`;
if (!source.includes('const sharePdf = async')) {
  const printPattern = /  const printReport = async \(\) => \{[\s\S]*?\n  \};\n/;
  const printMatch = source.match(printPattern);
  if (printMatch) {
    source = source.replace(printPattern, `${printMatch[0]}${shareFunction}`);
  } else {
    const legacyPrintAnchor = '  const printReport = () => window.print();\n';
    if (!source.includes(legacyPrintAnchor)) throw new Error("ManagerReports share patch: print function anchor not found.");
    source = source.replace(legacyPrintAnchor, `${legacyPrintAnchor}${shareFunction}`);
  }
}

const stateAnchor = '  const [employees, setEmployees] = useState<Employee[]>(getEmployees()), [audit, setAudit] = useState<Audit[]>([]), [requests, setRequests] = useState<RequestRow[]>([]), [dailyStatus, setDailyStatus] = useState<DailyStatusRow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);';
if (source.includes(stateAnchor) && !source.includes('sharingPdf')) {
  source = source.replace(stateAnchor, `${stateAnchor}\n  const [sharingPdf, setSharingPdf] = useState(false);`);
} else if (!source.includes('sharingPdf')) {
  throw new Error("ManagerReports share patch: state anchor not found.");
}

const buttonAnchor = '<Button variant="outline" onClick={printReport} disabled={!summaries.length}><Printer className="ml-2 h-4 w-4" />طباعة الخدمة</Button>';
const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf}><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري تجهيز PDF…" : "مشاركة PDF"}</Button>';
if (source.includes(buttonAnchor) && !source.includes("مشاركة PDF")) {
  source = source.replace(buttonAnchor, `${buttonAnchor}${shareButton}`);
} else if (!source.includes("مشاركة PDF")) {
  throw new Error("ManagerReports share patch: daily print button anchor not found.");
}

if (!source.includes('from "html2canvas"')) throw new Error("ManagerReports share patch: html2canvas import was not applied.");
if (!source.includes('from "jspdf"')) throw new Error("ManagerReports share patch: jsPDF import was not applied.");
if (!source.includes('const sharePdf = async')) throw new Error("ManagerReports share patch: share function was not applied.");
if (!source.includes("مشاركة PDF")) throw new Error("ManagerReports share patch: share button was not applied.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily service can be rendered to a real PDF and shared through the native Android share sheet (WhatsApp/Telegram) with download fallback.");
