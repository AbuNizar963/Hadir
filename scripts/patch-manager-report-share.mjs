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

if (!source.includes('const sharePdf = async')) {
  const shareFunction = `  const sharePdf = async () => {
    if (mode !== "daily" || !summaries.length) return;
    const report = document.querySelector<HTMLElement>(".service-report");
    if (!report) return;
    try {
      setSharingPdf(true);
      const fresh = await refreshDailyReportSnapshot();
      if (!fresh) return;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const canvas = await html2canvas(report, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
        windowWidth: report.scrollWidth,
        windowHeight: report.scrollHeight,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const pageWidth = 297, pageHeight = 210, margin = 5;
      const contentWidth = pageWidth - margin * 2, contentHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * contentWidth) / canvas.width;
      const sourcePageHeight = Math.max(1, Math.floor((contentHeight / imageHeight) * canvas.height));
      let sourceY = 0, page = 0;
      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width; pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("تعذر تجهيز صفحة PDF");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (page > 0) pdf.addPage();
        const sliceMmHeight = (sliceHeight * contentWidth) / canvas.width;
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, contentWidth, Math.min(contentHeight, sliceMmHeight), undefined, "FAST");
        sourceY += sliceHeight; page++;
      }
      const blob = pdf.output("blob");
      const filename = `Hadir-خدمة-${date}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      const shareData = { files: [file], title: `خدمة الدوام · ${formatDate(date)}`, text: `تقرير خدمة الدوام ليوم ${formatDate(date)}` };
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") console.error("تعذر إنشاء أو مشاركة PDF للخدمة:", error);
    } finally {
      setSharingPdf(false);
    }
  };
`;
  const livePrint = '  const printReport = async () => { if (mode !== "daily") { window.print(); return; } const fresh = await refreshDailyReportSnapshot(); if (!fresh) return; window.requestAnimationFrame(() => window.print()); };';
  const legacyPrint = '  const printReport = () => window.print();';
  if (source.includes(livePrint)) source = source.replace(livePrint, `${livePrint}\n${shareFunction}`);
  else if (source.includes(legacyPrint)) source = source.replace(legacyPrint, `${legacyPrint}\n${shareFunction}`);
  else throw new Error("ManagerReports share patch: print function anchor not found after live patch.");
}

if (!source.includes('sharingPdf')) {
  const statePattern = /(  const \[employees, setEmployees\] = useState<Employee\[\]>(getEmployees\(\)), \[audit, setAudit\] = useState<Audit\[\]\>\(\[\]\), \[requests, setRequests\] = useState<RequestRow\[\]\>\(\[\]\), \[dailyStatus, setDailyStatus\] = useState<DailyStatusRow\[\]\>\(\[\]\), \[loading, setLoading\] = useState\(true\), \[error, setError\] = useState<string \| null>\(null\), \[expanded, setExpanded\] = useState<string \| null>\(null\);)/;
  if (!statePattern.test(source)) throw new Error("ManagerReports share patch: state anchor not found.");
  source = source.replace(statePattern, '$1\n  const [sharingPdf, setSharingPdf] = useState(false);');
}

if (!source.includes("مشاركة PDF")) {
  const buttonAnchor = '<Button variant="outline" onClick={printReport} disabled={!summaries.length}><Printer className="ml-2 h-4 w-4" />طباعة الخدمة</Button>';
  const shareButton = '<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf}><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري تجهيز PDF…" : "مشاركة PDF"}</Button>';
  if (!source.includes(buttonAnchor)) throw new Error("ManagerReports share patch: daily print button anchor not found.");
  source = source.replace(buttonAnchor, `${buttonAnchor}${shareButton}`);
}

if (!source.includes('from "html2canvas"') || !source.includes('from "jspdf"') || !source.includes('const sharePdf = async') || !source.includes('sharingPdf') || !source.includes("مشاركة PDF")) {
  throw new Error("ManagerReports share patch: PDF sharing patch was not applied completely.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports share patch: daily PDF sharing button and native Android share flow applied.");
