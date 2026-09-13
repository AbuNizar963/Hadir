import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) {
  throw new Error("ManagerReports Damascus date patch: source file not found.");
}

let source = readFileSync(file, "utf8");
if (source.includes("function damascusTodayKey()")) {
  console.log("ManagerReports Damascus date patch: already applied.");
  process.exit(0);
}

const todayPattern = /function todayLocal\(\)\s*\{\s*const d = new Date\(\);\s*return new Date\(d\.getFullYear\(\), d\.getMonth\(\), d\.getDate\(\), 12\);\s*\}/m;
if (!todayPattern.test(source)) {
  throw new Error(
    "ManagerReports Damascus date patch: todayLocal anchor not found; refusing unsafe replacement.",
  );
}

source = source.replace(
  todayPattern,
  'function damascusTodayKey() {\n  return new Intl.DateTimeFormat("en-CA", {\n    timeZone: "Asia/Damascus",\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n  }).format(new Date());\n}\nfunction todayLocal() {\n  return dateOf(damascusTodayKey());\n}',
);

const statePattern = /const \[mode, setMode\] = useState<Mode>\("monthly"\),\s*\[date, setDate\] = useState\([^\)]*\),\s*\[month, setMonth\] = useState\([^\)]*\),\s*\[year, setYear\] = useState\([^\)]*\);/m;
if (!statePattern.test(source)) {
  throw new Error(
    "ManagerReports Damascus date patch: period state anchor not found; refusing unsafe replacement.",
  );
}

source = source.replace(
  statePattern,
  'const damascusToday = damascusTodayKey();\n  const [mode, setMode] = useState<Mode>("monthly"),\n    [date, setDate] = useState(damascusToday),\n    [month, setMonth] = useState(damascusToday.slice(0, 7)),\n    [year, setYear] = useState(damascusToday.slice(0, 4));',
);

writeFileSync(file, source, "utf8");
console.log("ManagerReports Damascus date patch: applied safely.");
