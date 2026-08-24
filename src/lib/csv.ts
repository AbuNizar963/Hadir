/**
 * تنزيل ملف CSV مع دعم كامل للغة العربية داخل Excel.
 * - يبدأ الملف بـ UTF-8 BOM (\uFEFF) لضمان قراءة النصوص العربية بشكل صحيح.
 * - يستخدم CRLF (\r\n) لأسطر النهاية لتوافق أفضل مع Excel على ويندوز.
 * - يهرب علامات الاقتباس المزدوجة داخل الخلايا حسب معيار RFC 4180.
 */
export type CsvCell = string | number | null | undefined;

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: CsvCell[][]
): void {
  const escape = (val: CsvCell): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headerLine = headers.map(escape).join(",");
  const bodyLines = rows.map((row) => row.map(escape).join(","));
  const csvContent = [headerLine, ...bodyLines].join("\r\n");

  // Excel does not reliably persist worksheet direction in CSV; use an RTL-friendly hint.
  const rtlMark = "\u200F";

  // Prefix UTF-8 BOM so Excel opens Arabic text without corruption.
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + rtlMark + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 200);
}
