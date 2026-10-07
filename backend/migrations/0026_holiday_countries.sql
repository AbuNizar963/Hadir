CREATE TABLE IF NOT EXISTS holiday_countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  source_version TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
