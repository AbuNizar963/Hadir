import Holidays from "date-holidays";

export type HolidayCountry = "SA" | "AE" | "JO" | "EG" | "QA" | "KW" | "BH" | "OM" | "GB" | "US" | "SY";

export const HOLIDAY_COUNTRIES: Record<HolidayCountry, string> = {
  SA: "السعودية",
  AE: "الإمارات العربية المتحدة",
  JO: "الأردن",
  EG: "مصر",
  QA: "قطر",
  KW: "الكويت",
  BH: "البحرين",
  OM: "عُمان",
  GB: "المملكة المتحدة",
  US: "الولايات المتحدة",
  SY: "سوريا",
};

const isDay = (value: string, day: string) => value.slice(0, 10) === day;

/** Returns the official public-holiday name for a configured local calendar day. */
export function publicHolidayForDay(day: string, country: string | null | undefined) {
  const code = String(country || "").trim().toUpperCase() as HolidayCountry;
  if (!code || !HOLIDAY_COUNTRIES[code]) return null;

  // date-holidays does not currently ship a Syria calendar; keep its fixed
  // national holidays explicit while using the maintained calendars for the
  // other supported countries.
  if (code === "SY") {
    const fixed: Record<string, string> = {
      "01-01": "رأس السنة الميلادية",
      "04-17": "عيد الجلاء",
      "05-01": "عيد العمال",
      "05-06": "عيد الشهداء",
      "10-06": "ذكرى حرب تشرين التحريرية",
      "12-25": "عيد الميلاد المجيد",
    };
    return fixed[day.slice(5)] || null;
  }

  const fixedByCountry: Partial<Record<HolidayCountry, Record<string, string>>> = {
    JO: { "01-01": "رأس السنة الميلادية", "05-01": "عيد العمال", "05-25": "عيد الاستقلال", "12-25": "عيد الميلاد المجيد" },
    QA: { "02-22": "يوم التأسيس", "12-18": "اليوم الوطني" },
    KW: { "02-25": "العيد الوطني", "02-26": "يوم التحرير", "01-01": "رأس السنة الميلادية" },
    OM: { "01-11": "يوم تولي العرش", "11-18": "اليوم الوطني", "11-19": "اليوم الوطني" },
  };
  const fixed = fixedByCountry[code]?.[day.slice(5)];
  if (fixed) return fixed;

  try {
    const holidays = new Holidays(code).getHolidays(Number(day.slice(0, 4)));
    const match = holidays.find((holiday) => holiday.type === "public" && isDay(holiday.date, day));
    return match?.name || null;
  } catch {
    return null;
  }
}
