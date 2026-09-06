import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) throw new Error("ManagerReports canonical patch: source file not found.");
let source = readFileSync(file, "utf8");

if (source.includes("function calculateDetails(employee: Employee, dates: Date[]") && source.includes("_index: Map<string, { in?: Audit; out?: Audit }>") && !source.includes('import { getEmployeeWorkPeriod } from "@/lib/schedule";')) {
  console.log("ManagerReports canonical patch: already applied.");
  process.exit(0);
}

const detailsStart = source.indexOf("function calculateDetails(");
const summaryStart = source.indexOf("function calculateSummary(", detailsStart);
const serviceStart = source.indexOf("function serviceRows(", summaryStart);
const componentStart = source.indexOf("export default function ManagerReports()", serviceStart);
if (detailsStart < 0 || summaryStart < 0 || serviceStart < 0 || componentStart < 0) {
  throw new Error("ManagerReports canonical patch: report function anchors not found.");
}

const replacementFunctions = `function calculateDetails(employee: Employee, dates: Date[], _index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>): DayRow[] {
  const detail: DayRow[] = [];
  for (const d of dates) {
    const k = key(d), dailyRow = dailyStatusByDate?.get(k)?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cin = dailyRow?.checkInAt ? new Date(dailyRow.checkInAt) : null;
    const cout = dailyRow?.checkOutAt ? new Date(dailyRow.checkOutAt) : null;
    const scheduledStart = dailyRow?.scheduledStart ? new Date(dailyRow.scheduledStart) : null;
    const scheduledEnd = dailyRow?.scheduledEnd ? new Date(dailyRow.scheduledEnd) : null;
    const lm = cin && scheduledStart ? Math.max(0, Math.round((cin.getTime() - scheduledStart.getTime()) / 60000) - grace) : 0;
    const wd = cin && cout ? Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())) : 0;
    const em = cout && scheduledEnd ? Math.max(0, Math.round((scheduledEnd.getTime() - cout.getTime()) / 60000)) : 0;
    const status: Status = serverStatus || "absent";
    const detailText = [status === "off" ? "لا يوجد دوام" : status === "not_started" ? "لم يبدأ الدوام" : "الحالة المعتمدة من الخادم", requestText(requests, employee.id, k)].filter(Boolean).join(" · ");
    detail.push({ date: k, day: days[d.getDay()], status, checkIn: cin ? formatTime(cin.toISOString()) : "—", checkOut: cout ? formatTime(cout.toISOString()) : "—", worked: wd, late: lm, early: em, detail: detailText });
  }
  return detail;
}
function calculateSummary(employee: Employee, dates: Date[], _index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>): Summary {
  let workDays = 0, present = 0, absent = 0, early = 0, late = 0, open = 0, permission = 0, leave = 0, off = 0, worked = 0, lateMinutes = 0, earlyMinutes = 0;
  for (const d of dates) {
    const k = key(d), dailyRow = dailyStatusByDate?.get(k)?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    if (serverStatus === "off") { off++; continue; }
    if (serverStatus === "leave") { leave++; continue; }
    if (serverStatus === "permission") { permission++; continue; }
    workDays++;
    if (serverStatus === "not_started") continue;
    if (serverStatus === "absent" || !serverStatus) { absent++; continue; }
    const cin = dailyRow?.checkInAt ? new Date(dailyRow.checkInAt) : null;
    const cout = dailyRow?.checkOutAt ? new Date(dailyRow.checkOutAt) : null;
    const scheduledStart = dailyRow?.scheduledStart ? new Date(dailyRow.scheduledStart) : null;
    const scheduledEnd = dailyRow?.scheduledEnd ? new Date(dailyRow.scheduledEnd) : null;
    const lm = cin && scheduledStart ? Math.max(0, Math.round((cin.getTime() - scheduledStart.getTime()) / 60000) - grace) : 0;
    const wd = cin && cout ? Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())) : 0;
    const em = cout && scheduledEnd ? Math.max(0, Math.round((scheduledEnd.getTime() - cout.getTime()) / 60000)) : 0;
    lateMinutes += lm;
    earlyMinutes += em;
    worked += wd;
    if (serverStatus === "open") open++;
    else if (serverStatus === "late") late++;
    else if (serverStatus === "present") present++;
    else if (em) early++;
    else if (serverStatus === "early") early++;
    else if (serverStatus === "invalid") absent++;
  }
  return { employee, workDays, present, absent, early, late, open, permission, leave, off, worked, lateMinutes, earlyMinutes };
}
function specialtyOf(e: Employee) { return (e.specialties || []).map(x => String(x).trim()).filter(Boolean)[0] || "غير محدد"; }
function serviceRows(summaries: Summary[], dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatusByDate?: Map<string, Map<string, DailyStatusRow>>) {
  return summaries.map(s => { const d = calculateDetails(s.employee, datesForEmployee(s.employee, dates), index, settings, requests, dailyStatusByDate)[0]; return { employee: s.employee, specialty: specialtyOf(s.employee), status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, note: d.detail }; });
}

`;
source = source.slice(0, detailsStart) + replacementFunctions + source.slice(componentStart);

source = source.replace('import { getEmployeeWorkPeriod } from "@/lib/schedule";\n', "");
source = source.replace(/mode === "daily" \? dailyStatusMap : undefined/g, "dailyStatusByDate");

if (!source.includes("dailyStatusByDate?.get(k)?.get(employee.id)")) throw new Error("ManagerReports canonical patch: canonical daily lookup was not applied.");
if (source.includes('import { getEmployeeWorkPeriod } from "@/lib/schedule";')) throw new Error("ManagerReports canonical patch: local schedule import remains.");

writeFileSync(file, source, "utf8");
console.log("ManagerReports canonical patch: applied safely; report status now comes from daily_attendance_status.");
