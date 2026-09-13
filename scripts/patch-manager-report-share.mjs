import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const lucideImportPattern = /import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];/m;
const lucideImportMatch = source.match(lucideImportPattern);
if (!lucideImportMatch) {
  throw new Error("ManagerReports share patch: lucide-react import not found.");
}

if (!/\bShare2\b/.test(lucideImportMatch[1])) {
  const imports = lucideImportMatch[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  imports.push("Share2");

  const replacement = `import {\n  ${imports.join(",\n  ")},\n} from "lucide-react";`;
  source = source.replace(lucideImportMatch[0], replacement);
}

const pdfImport = 'import { generateProfessionalReportPdf } from "@/lib/professionalPdf";';
if (!source.includes(pdfImport)) {
  const backendImportMatch = source.match(
    /import\s*\{[\s\S]*?\}\s*from\s*["']@\/lib\/backend["'];/m,
  );
  if (!backendImportMatch) {
    throw new Error("ManagerReports share patch: backend import anchor not found.");
  }
  source = source.replace(
    backendImportMatch[0],
    `${backendImportMatch[0]}\n${pdfImport}`,
  );
}

if (!source.includes("sharingPdf")) {
  const modeStatePattern =
    /  const \[mode, setMode\] = useState<Mode>\("monthly"\)[^;]*;/m;
  const modeStateMatch = source.match(modeStatePattern);
  if (!modeStateMatch) {
    throw new Error("ManagerReports share patch: mode state anchor not found.");
  }

  source = source.replace(
    modeStateMatch[0],
    `${modeStateMatch[0]}\n  const [sharingPdf, setSharingPdf] = useState(false);\n  const [readyPdf, setReadyPdf] = useState<File | null>(null);`,
  );
}

if (!source.includes("const sharePdf = async")) {
  const shareFunction = `  const sharePdf = async () => {
    if (mode !== "daily" || !summaries.length) return;

    // Web Share must be invoked directly from a user gesture. The PDF itself
    // is generated asynchronously, so the first click prepares it and the
    // button becomes a second, explicit user gesture for the native share UI.
    if (readyPdf) {
      const shareData = { files: [readyPdf] };
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [readyPdf] }))
      ) {
        try {
          await navigator.share(shareData);
        } catch (error) {
          if ((error as DOMException)?.name !== "AbortError") {
            console.error("تعذر مشاركة PDF:", error);
            window.alert(
              error instanceof Error ? error.message : "تعذر مشاركة ملف PDF",
            );
          }
        }
      } else {
        const url = URL.createObjectURL(readyPdf);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = readyPdf.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }

    const report = document.querySelector<HTMLElement>(".service-report");
    if (!report) {
      window.alert("تعذر العثور على محتوى التقرير");
      return;
    }

    try {
      setSharingPdf(true);
      setReadyPdf(null);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const clone = report.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll<HTMLElement>("[data-hadir-pdf-exclude]")
        .forEach((node) => node.remove());

      const stylesheetLinks = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      )
        .map((link) => link.href)
        .filter(Boolean)
        .map(
          (href) =>
            '<link rel="stylesheet" href="' +
            href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") +
            '">',
        )
        .join("");
      const inlineStyles = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent || "")
        .join("\\n");
      const printCssUrl = new URL(
        "/report-print.css",
        window.location.origin,
      ).href;
      const documentHtml =
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>سجل الحضور والغياب</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
        stylesheetLinks +
        '<link rel="stylesheet" href="' +
        printCssUrl +
        '"><style>' +
        inlineStyles +
        '</style></head><body dir="rtl"><main>' +
        clone.outerHTML +
        "</main></body></html>";

      let printCss = "";
      try {
        printCss = await fetch(printCssUrl, { cache: "no-store" }).then(
          (response) => (response.ok ? response.text() : ""),
        );
      } catch {
        // The stylesheet is already linked in the generated HTML.
      }

      const companyName =
        String(settings.brandName || "الشركة")
          .trim()
          .replace(/[\\/:*?"<>|]/g, "-") || "الشركة";
      const reportDate = date;
      const reportDay = days[dateOf(reportDate).getDay()];
      const dayNumber = String(dateOf(reportDate).getDate());
      const monthNumber = String(dateOf(reportDate).getMonth() + 1);
      const yearNumber = String(dateOf(reportDate).getFullYear());
      const displayDate = `${dayNumber}/${monthNumber}/${yearNumber}`;
      const filename = `${companyName} - سجل الحضور والغياب - ليوم ${reportDay} - تاريخ ${displayDate}.pdf`;
      const blob = await generateProfessionalReportPdf(
        documentHtml,
        printCss,
        filename,
      );
      setReadyPdf(new File([blob], filename, { type: "application/pdf" }));
    } catch (error) {
      console.error("تعذر إنشاء PDF:", error);
      window.alert(
        error instanceof Error ? error.message : "تعذر تجهيز ملف PDF",
      );
    } finally {
      setSharingPdf(false);
    }
  };
`;

  const titleAnchor = "  const title =";
  if (!source.includes(titleAnchor)) {
    throw new Error("ManagerReports share patch: title anchor not found.");
  }
  source = source.replace(titleAnchor, `${shareFunction}${titleAnchor}`);
}

const shareButton = `<Button variant="outline" onClick={sharePdf} disabled={!summaries.length || sharingPdf} data-hadir-share="true"><Share2 className="ml-2 h-4 w-4" />{sharingPdf ? "جاري إنشاء PDF…" : readyPdf ? "مشاركة PDF الآن" : "تجهيز PDF للمشاركة"}</Button>`;
const csvButton = `<Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>`;
const dailyCsvReplacement = `{mode === "daily" ? ${shareButton} : ${csvButton}}`;

if (!source.includes(dailyCsvReplacement)) {
  if (!source.includes(csvButton)) {
    throw new Error(
      "ManagerReports share patch: exact CSV JSX anchor not found; refusing unsafe replacement.",
    );
  }
  source = source.replace(csvButton, dailyCsvReplacement);
}

const hasRenderedShareControl =
  source.includes('data-hadir-share="true"') &&
  source.includes("onClick={sharePdf}") &&
  source.includes("مشاركة PDF الآن") &&
  source.includes('mode === "daily" ?');
const hasRenderedPrintControl =
  source.includes("onClick={printReport}") &&
  source.includes("طباعة الخدمة");

if (
  !source.includes('from "@/lib/professionalPdf"') ||
  !source.includes("const sharePdf = async") ||
  !source.includes("readyPdf") ||
  !source.includes("sharingPdf") ||
  !source.includes("سجل الحضور والغياب - ليوم") ||
  !hasRenderedShareControl ||
  !hasRenderedPrintControl
) {
  throw new Error(
    `ManagerReports share patch: PDF sharing, filename and print buttons were not all applied completely (share=${hasRenderedShareControl}, print=${hasRenderedPrintControl}).`,
  );
}

writeFileSync(file, source, "utf8");
console.log(
  "ManagerReports share patch: daily PDF sharing is applied safely; monthly and annual CSV export remains unchanged.",
);
