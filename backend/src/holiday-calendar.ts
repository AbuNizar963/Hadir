import { publicHolidaysForYear, isSupportedHolidayCountry } from "./public-holidays";

const SOURCE_VERSION = "date-holidays-3.25.0";

type HolidayRow = {
  countryCode: string;
  holidayDate: string;
  name: string;
  type: string;
  year: number;
  sourceVersion: string;
  updatedAt: string;
};

export async function ensureHolidayCalendarTable(db: D1Database) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS official_holidays(country_code TEXT NOT NULL,holiday_date TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'public',year INTEGER NOT NULL,source_version TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(country_code,holiday_date))",
  ).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_official_holidays_year ON official_holidays(country_code,year,holiday_date)",
  ).run();
}

export async function refreshHolidayCalendar(db: D1Database, country: string, year: number) {
  const code = String(country || "").trim().toUpperCase();
  if (!isSupportedHolidayCountry(code)) throw new Error("الدولة غير مدعومة في قاعدة العطل المحلية");
  if (!Number.isInteger(year) || year < 1970 || year > 2100) throw new Error("السنة غير صالحة");
  const holidays = publicHolidaysForYear(code, year);
  const updatedAt = new Date().toISOString();
  const statements = [db.prepare("DELETE FROM official_holidays WHERE country_code=? AND year=?").bind(code, year)];
  for (const holiday of holidays) {
    statements.push(db.prepare("INSERT INTO official_holidays(country_code,holiday_date,name,type,year,source_version,updated_at) VALUES(?,?,?,?,?,?,?)").bind(code, holiday.date, holiday.name, holiday.type, year, SOURCE_VERSION, updatedAt));
  }
  await db.batch(statements);
  return { countryCode: code, year, count: holidays.length, sourceVersion: SOURCE_VERSION, updatedAt };
}

export async function readHolidayCalendar(db: D1Database, country: string, year: number) {
  const code = String(country || "").trim().toUpperCase();
  const rows = await db.prepare("SELECT country_code AS countryCode,holiday_date AS date,name,type,year,source_version AS sourceVersion,updated_at AS updatedAt FROM official_holidays WHERE country_code=? AND year=? ORDER BY holiday_date").bind(code, year).all<HolidayRow>();
  return rows.results || [];
}

export async function holidayNameFromLocalCalendar(db: D1Database, day: string, country: string) {
  const row = await db.prepare("SELECT name FROM official_holidays WHERE country_code=? AND holiday_date=? LIMIT 1").bind(String(country || "").trim().toUpperCase(), day).first<{ name: string }>();
  return row?.name || null;
}
