CREATE TABLE IF NOT EXISTS official_holidays (
  country_code TEXT NOT NULL,
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  year INTEGER NOT NULL,
  source_version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(country_code, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_official_holidays_year
  ON official_holidays(country_code, year, holiday_date);
