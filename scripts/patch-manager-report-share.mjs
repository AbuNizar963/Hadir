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
  const shareFunction = `  const sharePdf = async () => {\n    if (mode !== "daily" || !summaries.length) return;\n    const report = document.querySelector<HTMLElement>(".service-report");\n    if (!report) return;\n    try {\n      setSharingPdf(true);\n      const fresh = await refreshDailyReportSnapshot();\n      if (!fresh) return;\n      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));\n      const canvas = await html2canvas(report, { backgroundColor: "#ffffff", scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)), useCORS: true, logging: false, windowWidth: report.scrollWidth, windowHeight: report.scrollHeight });\n      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });\n      const pageWidth = 297, pageHeight = 210, margin = 5, contentWidth = pageWidth - margin * 2, contentHeight = pageHeight - margin * 2;\n      const imageHeight = (canvas.height * contentWidth) / canvas.width;\n      const sourcePageHeight = Math.max(1, Math.floor((contentHeight / imageHeight) * canvas.height));\n      let sourceY = 0, page = 0;\n      while (sourceY < canvas.height) {\n        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);\n        const pageCanvas = document.createElement("canvas");\n        pageCanvas.width = canvas.width; pageCanvas.height = sliceHeight;\n        const ctx = pageCanvas.getContext("2d");\n        if (!ctx) throw new Error("تعذر تجهيز صفحة PDF");\n        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);\n        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);\n        if (page > 0) pdf.addPage();\n        const sliceMmHeight = (sliceHeight * contentWidth) / canvas.width;\n        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, contentWidth, Math.min(contentHeight, sliceMmHeight), undefined, "FAST");\n        sourceY += sliceHeight; page++;\n      }\n      const blob = pdf.output("blob");\n      const filename = \`Hadir-خدمة-\${date}.pdf\`;\n      const file = new File([blob], filename, { type: "application/pdf" });\n      const shareData = { files: [file], title: \`خدمة الدوام · \${formatDate(date)}\`, text: \`تقرير خدمة الدوام ليوم \${formatDate(date)}\` };\n      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {\n        await navigator.share(shareData);\n      } else {\n        const url = URL.createObjectURL(blob);\n        const a = document.createElement("a"); a.href = url; a.download = filename;\n        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);\n      }\n    } catch (error) {\n      if ((error as DOMException)?.name !== "AbortError") console.error("تعذر إنشاء أو مشاركة PDF للخدمة:", error);\n    } finally {\n      setSharingPdf(false);\n    }\n  };\n`;
  const titleAnchor = '  const title = ';
  if (!source.includes(titleAnchor)) throw new Error("ManagerReports share patch: title anchor not found.");
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

if (!source.includes("مشاركة PDF")) {
  const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf}><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري تجهيز PDF…" : "مشاركة PDF"}</Button>';
  const printButtonPattern = /(<Button variant="outline" onClick=\{printReport\} disabled=\{!summaries\.length\}><Printer className="ml-2 h-4 w-4" \/>طباعة الخدمة<\/Button>)/;
  if (!printButtonPattern.test(source)) throw new Error("ManagerReports share patch: daily print button anchor not found.");
  source = source.replace(printButtonPattern, `$1${shareButton}`);
}

if (!source.includes('from "html2canvas"') || !source.includes('from "jspdf"') || !source.includes('const sharePdf = async') || !source.includes('sharingPdf') || !source.includes("مشاركة PDF")) {
  throw new Error("ManagerReports share patch: PDF sharing patch was not applied completely.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily PDF sharing button and native Android share flow applied.");
