import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) throw new Error("ManagerReports historical patch: source file not found.");
let source = readFileSync(file, "utf8");

if (source.includes("const [dailyStatusByDate, setDailyStatusByDate]")) {
  console.log("ManagerReports historical patch: already applied.");
  process.exit(0);
}

const detailsStart = source.indexOf("function calculateDetails(");
const summaryStart = source.indexOf("function calculateSummary(", detailsStart);
const serviceStart = source.indexOf("function serviceRows(", summaryStart);
const componentStart = source.indexOf("export default function ManagerReports()", serviceStart);
if (detailsStart < 0 || summaryStart < 0 || serviceStart < 0 || componentStart < 0) {
  throw new Error("ManagerReports historical patch: report function anchors not found.");
}

const replacementFunctions = `function calculateDetails(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>): DayRow[] {
  const detail: DayRow[] = [];
  for (const d of dates) {
    const w = getEmployeeWorkPeriod(employee, d), k = key(d), req = approvedRequestFor(requests, employee.id, k);
    if (!w.isWorkDay) { detail.push({ date: k, day: days[d.getDay()], status: "off", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: w.detail || "لا يوجد دوام" }); continue; }
    if (req?.type === "leave") { detail.push({ date: k, day: days[d.getDay()], status: "leave", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: requestText(requests, employee.id, k) }); continue; }
    if (req?.type === "permission") { detail.push({ date: k, day: days[d.getDay()], status: "permission", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: requestText(requests, employee.id, k) }); continue; }
    const s = index.get(employee.id + "|" + k), dailyRow = dailyStatusByDate?.get(k)?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = dailyRow?.checkInAt || s?.in?.timestamp || null, coutValue = dailyRow?.checkOutAt || s?.out?.timestamp || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;
    let st: Status = "absent", lm = 0, em = 0, wd = 0;
    if (cin) {
      lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0;
      if (cout) { wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())); em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0; st = em ? "early" : lm ? "late" : "present"; }
      else st = "open";
    }
    if (serverStatus) st = serverStatus === "late" && !cout ? "open" : serverStatus;
    detail.push({ date: k, day: days[d.getDay()], status: st, checkIn: cin ? formatTime(cin.toISOString()) : "—", checkOut: cout ? formatTime(cout.toISOString()) : "—", worked: wd, late: lm, early: em, detail: [w.detail || "يوم عمل", requestText(requests, employee.id, k)].filter(Boolean).join(" · ") });
  }
  return detail;
}
function calculateSummary(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>): Summary {
  let workDays = 0, present = 0, absent = 0, early = 0, late = 0, open = 0, permission = 0, leave = 0, off = 0, worked = 0, lateMinutes = 0, earlyMinutes = 0;
  for (const d of dates) {
    const w = getEmployeeWorkPeriod(employee, d), k = key(d), req = approvedRequestFor(requests, employee.id, k), dailyRow = dailyStatusByDate?.get(k)?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    if (!w.isWorkDay) { off++; continue; }
    workDays++;
    if (req?.type === "leave") { leave++; continue; }
    if (req?.type === "permission") { permission++; continue; }
    const s = index.get(employee.id + "|" + k);
    const cinValue = dailyRow?.checkInAt || s?.in?.timestamp || null, coutValue = dailyRow?.checkOutAt || s?.out?.timestamp || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;
    if (serverStatus === "not_started") continue;
    if (serverStatus === "off") { off++; continue; }
    if (serverStatus === "leave") { leave++; continue; }
    if (serverStatus === "permission") { permission++; continue; }
    if (serverStatus === "absent") { absent++; continue; }
    if (!cin) { absent++; continue; }
    const lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0; lateMinutes += lm;
    if (!cout) { open++; continue; }
    const wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())); worked += wd;
    const em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0; earlyMinutes += em;
    if (serverStatus === "late") late++; else if (serverStatus === "early" || em) early++; else if (serverStatus === "present") present++; else if (em) early++; else if (lm) late++; else present++;
  }
  return { employee, workDays, present, absent, early, late, open, permission, leave, off, worked, lateMinutes, earlyMinutes };
}
function specialtyOf(e: Employee) { return (e.specialties || []).map(x => String(x).trim()).filter(Boolean)[0] || "غير محدد"; }
function serviceRows(summaries: Summary[], dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>) {
  return summaries.map(s => { const d = calculateDetails(s.employee, datesForEmployee(s.employee, dates), index, settings, requests, dailyStatusByDate)[0]; return { employee: s.employee, specialty: specialtyOf(s.employee), status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, note: d.detail }; });
}

`;
source = source.slice(0, detailsStart) + replacementFunctions + source.slice(componentStart);

const statePattern = /const \[employees, setEmployees\] = useState<Employee\[\]>\(getEmployees\(\)\), \[audit, setAudit\] = useState<Audit\[\]>\(\[\]\), \[requests, setRequests\] = useState<RequestRow\[\]>\(\[\]\), \[dailyStatus, setDailyStatus\] = useState<DailyStatusRow\[\]>\(\[\]\), \[loading, setLoading\] = useState\(true\), \[error, setError\] = useState<string \| null>\(null\), \[expanded, setExpanded\] = useState<string \| null>\(null\);/;
if (!statePattern.test(source)) throw new Error("ManagerReports historical patch: state anchor not found.");
source = source.replace(statePattern, `const [employees, setEmployees] = useState<Employee[]>(getEmployees()), [audit, setAudit] = useState<Audit[]>([]), [requests, setRequests] = useState<RequestRow[]>([]), [dailyStatusByDate, setDailyStatusByDate] = useState<Map<string, Map<string, DailyStatusRow>>>(new Map()), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);`);

const effectStart = source.indexOf("  useEffect(() => {", source.indexOf("export default function ManagerReports()"));
const periodStart = source.indexOf("  const period =", effectStart);
if (effectStart < 0 || periodStart < 0) throw new Error("ManagerReports historical patch: effect anchor not found.");
const newEffect = `  useEffect(() => { let stop = false; let refreshTimer: number | undefined; const load = async () => { setLoading(true); setError(null); const e: string[] = []; const requestedDates = range(mode, mode === "daily" ? date : mode === "monthly" ? month : year).map(d => key(d)); try { const x = await getBackendEmployees(); if (!stop && Array.isArray(x)) setEmployees(x); } catch (x) { e.push(\`الموظفون: \${x instanceof Error ? x.message : "فشل الجلب"}\`); } try { const x = await getBackendAudit(2000); if (!stop && Array.isArray(x)) setAudit(x as Audit[]); } catch (x) { e.push(\`الحضور: \${x instanceof Error ? x.message : "فشل الجلب"}\`); } try { const x = await getBackendRequests("admin"); if (!stop && Array.isArray(x)) setRequests(x as RequestRow[]); } catch (x) { e.push(\`الطلبات: \${x instanceof Error ? x.message : "فشل الجلب"}\`); } try { const entries: Array<[string, Map<string, DailyStatusRow>]> = []; for (let start = 0; start < requestedDates.length; start += 6) { const batch = requestedDates.slice(start, start + 6); const results = await Promise.all(batch.map(async day => { const response = await getDailyStatus(day); return [day, new Map((Array.isArray(response.employees) ? response.employees : []).map(row => [String(row.employeeId), row]))] as [string, Map<string, DailyStatusRow>]; })); entries.push(...results); } if (!stop) setDailyStatusByDate(new Map(entries)); } catch (x) { e.push(\`الحالة اليومية التاريخية: \${x instanceof Error ? x.message : "فشل الجلب"}\`); } if (!stop) { setLoading(false); if (e.length) setError(e.join(" · ")); } }; const scheduleRefresh = () => { if (stop || document.visibilityState !== "visible") return; if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { refreshTimer = undefined; void load(); }, 300); }; void load(); const onCloudDataChanged = () => scheduleRefresh(); const onD1ViewChanged = () => scheduleRefresh(); const onOnline = () => scheduleRefresh(); const onVisibility = () => { if (document.visibilityState === "visible") scheduleRefresh(); }; window.addEventListener("hadir:cloud-data-changed", onCloudDataChanged); window.addEventListener("hadir:d1-view-changed", onD1ViewChanged); window.addEventListener("online", onOnline); document.addEventListener("visibilitychange", onVisibility); const fallbackTimer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 300000); return () => { stop = true; if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); window.clearInterval(fallbackTimer); window.removeEventListener("hadir:cloud-data-changed", onCloudDataChanged); window.removeEventListener("hadir:d1-view-changed", onD1ViewChanged); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisibility); }; }, [date, month, year, mode]);\n`;
source = source.slice(0, effectStart) + newEffect + source.slice(periodStart);

source = source.replace(`const dailyStatusMap = useMemo(() => new Map(dailyStatus.map(row => [row.employeeId, row])), [dailyStatus]);`, `const dailyStatusMap = useMemo(() => dailyStatusByDate.get(date) || new Map<string, DailyStatusRow>(), [dailyStatusByDate, date]);`);
source = source.replace(/mode === "daily" \? dailyStatusMap : undefined/g, "dailyStatusByDate");

if (!source.includes("dailyStatusByDate")) throw new Error("ManagerReports historical patch: integration failed.");
writeFileSync(file, source, "utf8");
console.log("ManagerReports historical patch: applied safely.");
