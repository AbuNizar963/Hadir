import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/PrayerPage.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) throw new Error(`Qibla page patch: ${label} anchor not found`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  'const greeting = () => {\n  const hour = new Date().getHours();\n  return hour < 5 ? "ليل سعيد" : hour < 12 ? "صباح الخير" : hour < 18 ? "نهار سعيد" : "مساء الخير";\n};',
  'const greeting = () => {\n  const hour = new Date().getHours();\n  return hour < 5 ? "ليل سعيد" : hour < 12 ? "صباح الخير" : hour < 18 ? "نهار سعيد" : "مساء الخير";\n};\n\nfunction formatGregorianDate(value: string, fallback: Date) {\n  const match = /^(\\d{1,2})\\s+([A-Za-z]{3,9})\\s+(\\d{4})$/.exec(String(value || "").trim());\n  if (match) {\n    const month = new Date(`${match[2]} 1, ${match[3]} 00:00:00`);\n    if (!Number.isNaN(month.getTime())) {\n      const date = new Date(Number(match[3]), month.getMonth(), Number(match[1]));\n      return new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);\n    }\n  }\n  return new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(fallback);\n}\n\nfunction formatHijriDate(value: string) {\n  const normalized = String(value || "").trim().replace(/\\s+/g, " ");\n  return normalized || "التاريخ الهجري غير متاح";\n}',
  "date format helpers",
);

replaceOnce(
  '<p className="mt-1 text-sm text-slate-300"><MapPin className="mr-1 inline h-4 w-4" />{city} • {data?.meta.gregorian || "جارٍ تحديد التاريخ"}{data?.meta.hijri && ` • ${data.meta.hijri}`}</p>',
  '<p className="mt-1 text-sm leading-6 text-slate-300"><MapPin className="mr-1 inline h-4 w-4" />{city} <span className="mx-1 text-slate-500">•</span><span className="whitespace-nowrap">{formatGregorianDate(data?.meta.gregorian || "", now)}</span><span className="mx-1 text-slate-500">•</span><span className="whitespace-nowrap">{formatHijriDate(data?.meta.hijri || "")}</span></p>',
  "readable date line",
);

replaceOnce(
  '<div className="rounded-3xl border border-white/10 bg-black/10 p-5"><div className="mb-4 flex items-center justify-between"><div className="font-black">بوصلة القبلة</div>',
  '<div onClick={() => { void locate(); void enableCompass(); }} className="cursor-pointer rounded-3xl border border-white/10 bg-black/10 p-5 transition hover:border-emerald-300/30"><div className="mb-4 flex items-center justify-between"><div className="font-black">بوصلة القبلة</div>',
  "automatic qibla activation",
);

replaceOnce(
  'setSensorMessage("حرّك الهاتف ببطء؛ السهم الأحمر يتجه مباشرة نحو القبلة.");',
  'setSensorMessage("تم تفعيل الحساس. حرّك الهاتف ببطء حتى يثبت الاتجاه؛ السهم يتجه مباشرة نحو القبلة.");',
  "sensor guidance",
);

writeFileSync(fileUrl, source, "utf8");
console.log("Qibla page patch applied: automatic location activation, readable Gregorian/Hijri date, and live compass guidance.");
