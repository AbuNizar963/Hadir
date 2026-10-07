import Holidays from "date-holidays";
import {
  HOLIDAY_COUNTRIES,
  HOLIDAY_COUNTRY_CODES,
  type HolidayCountry,
} from "./holiday-catalog";

export { HOLIDAY_COUNTRIES };
export type { HolidayCountry };

const fixedByCountry: Record<string, Record<string, string>> = {
  SY: {
    "01-01": "رأس السنة الميلادية",
    "04-17": "عيد الجلاء",
    "05-01": "عيد العمال",
    "05-06": "عيد الشهداء",
    "10-06": "ذكرى حرب تشرين التحريرية",
    "12-25": "عيد الميلاد المجيد",
  },
  JO: {
    "01-01": "رأس السنة الميلادية",
    "05-01": "عيد العمال",
    "05-25": "عيد الاستقلال",
    "12-25": "عيد الميلاد المجيد",
  },
  QA: { "02-22": "يوم التأسيس", "12-18": "اليوم الوطني" },
  KW: {
    "01-01": "رأس السنة الميلادية",
    "02-25": "العيد الوطني",
    "02-26": "يوم التحرير",
  },
  OM: {
    "01-11": "يوم تولي العرش",
    "11-18": "اليوم الوطني",
    "11-19": "اليوم الوطني",
  },
};

const isDay = (value: string, day: string) => value.slice(0, 10) === day;

export function isSupportedHolidayCountry(country: string | null | undefined) {
  return HOLIDAY_COUNTRY_CODES.has(
    String(country || "")
      .trim()
      .toUpperCase(),
  );
}

/** Returns all public holidays for one country and year from the local package data. */
export function publicHolidaysForYear(country: string, year: number) {
  const code = String(country || "")
    .trim()
    .toUpperCase();
  if (
    !isSupportedHolidayCountry(code) ||
    !Number.isInteger(year) ||
    year < 1970 ||
    year > 2100
  )
    return [];
  const values = new Map<
    string,
    { countryCode: string; date: string; name: string; type: string }
  >();
  for (const [monthDay, name] of Object.entries(fixedByCountry[code] || {})) {
    values.set(`${year}-${monthDay}`, {
      countryCode: code,
      date: `${year}-${monthDay}`,
      name,
      type: "public",
    });
  }
  try {
    const holidays = new Holidays(code).getHolidays(year);
    for (const holiday of holidays) {
      if (holiday.type !== "public") continue;
      const date = String(holiday.date).slice(0, 10);
      if (!date.startsWith(`${year}-`)) continue;
      values.set(date, {
        countryCode: code,
        date,
        name: String(holiday.name || "عطلة رسمية"),
        type: "public",
      });
    }
  } catch {
    // Keep fixed local holidays when a country calendar is unavailable.
  }
  return Array.from(values.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Returns the official public-holiday name for a configured local calendar day. */
export function publicHolidayForDay(
  day: string,
  country: string | null | undefined,
) {
  const code = String(country || "")
    .trim()
    .toUpperCase();
  if (!isSupportedHolidayCountry(code)) return null;
  const fixed = fixedByCountry[code]?.[day.slice(5)];
  if (fixed) return fixed;
  try {
    const holidays = new Holidays(code).getHolidays(Number(day.slice(0, 4)));
    const match = holidays.find(
      (holiday) => holiday.type === "public" && isDay(holiday.date, day),
    );
    return match?.name || null;
  } catch {
    return null;
  }
}
