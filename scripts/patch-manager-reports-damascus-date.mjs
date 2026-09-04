import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) throw new Error("ManagerReports Damascus date patch: source file not found.");
let source = readFileSync(file, "utf8");
if (source.includes("function damascusTodayKey()")) {
  console.log("ManagerReports Damascus date patch: already applied.");
  process.exit(0);
}

const todayAnchor = 'function todayLocal() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }';
if (!source.includes(todayAnchor)) throw new Error("ManagerReports Damascus date patch: todayLocal anchor not found.");
source = source.replace(todayAnchor, 'function damascusTodayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }\nfunction todayLocal() { return dateOf(damascusTodayKey()); }');

const stateAnchor = 'const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));';
if (!source.includes(stateAnchor)) throw new Error("ManagerReports Damascus date patch: period state anchor not found.");
source = source.replace(stateAnchor, 'const damascusToday = damascusTodayKey();\n  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(damascusToday), [month, setMonth] = useState(damascusToday.slice(0, 7)), [year, setYear] = useState(damascusToday.slice(0, 4));');

writeFileSync(file, source, "utf8");
console.log("ManagerReports Damascus date patch: applied safely.");
