import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getEmployees, getSettings } from "@/lib/storage";
import { getBackendAudit, getBackendEmployees, getBackendRequests } from "@/lib/backend";
import { getDailyStatus, type DailyStatusRow } from "@/lib/dailyStatus";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import { formatDate, formatDurationMinutes, formatTime, minutesBetween } from "@/lib/utils";
import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";
import type { Employee } from "@/types";

type Mode = "daily" | "monthly" | "annual";
type Status = "present" | "late" | "absent" | "early" | "open" | "permission" | "leave" | "off" | "not_started";
type Audit = { id?: string | number; employeeId?: string; action?: string; result?: string; timestamp?: string; jobNumber?: string; actorName?: string; employeeName?: string };
type RequestRow = { employeeId?: string; type?: string; reason?: string; status?: string; createdAt?: string; startDate?: string | null; endDate?: string | null };
type DayRow = { date: string; day: string; status: Status; checkIn: string; checkOut: string; worked: number; late: number; early: number; detail: string };
type Summary = { employee: Employee; workDays: number; present: number; absent: number; early: number; late: number; open: number; permission: number; leave: number; off: number; worked: number; lateMinutes: number; earlyMinutes: number };
type ServiceRow = { employee: Employee; specialty: string; status: Status; checkIn: string; checkOut: string; note: string };

const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const labels: Record<Status, string> = { present: "حاضر", late: "متأخر", absent: "غياب", early: "انصراف مبكر", open: "تسجيل ناقص", permission: "استئذان", leave: "إجازة", off: "راحة/عطلة", not_started: "لم يبدأ الدوام" };
const cls: Record<Status, string> = {
  present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  late: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  absent: "bg-red-500/15 text-red-700 dark:text-red-300",
  early: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  open: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  permission: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  leave: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  off: "bg-secondary text-muted-foreground",
  not_started: "bg-secondary text-muted-foreground"
};

function key(v: string | Date) { const d = typeof v === "string" ? new Date(v) : v; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dateOf(v: string) { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function todayLocal() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
function range(mode: Mode, p: string) {
  const today = todayLocal();
  if (mode === "daily") { const d = dateOf(p); return d <= today ? [d] : []; }
  if (mode === "monthly") { const [y, m] = p.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return Array.from({ length: last }, (_, i) => new Date(y, m - 1, i + 1, 12)).filter(d => d <= today); }
  const y = Number(p), r: Date[] = [];
  for (let m = 0; m < 12; m++) for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) { const date = new Date(y, m, d, 12); if (date <= today) r.push(date); }
  return r;
}
function auditIndex(a: Audit[]) {
  const m = new Map<string, { in?: Audit; out?: Audit }>();
  for (const x of a) {
    if (x.result !== "success" || !x.employeeId || !x.timestamp || (x.action !== "check-in" && x.action !== "check-out")) continue;
    const k = `${x.employeeId}|${key(x.timestamp)}`, c = m.get(k) || {};
    if (x.action === "check-in" && (!c.in || new Date(x.timestamp) < new Date(c.in.timestamp!))) c.in = x;
    if (x.action === "check-out" && (!c.out || new Date(x.timestamp) > new Date(c.out.timestamp!))) c.out = x;
    m.set(k, c);
  }
  return m;
}
function approvedRequestFor(requests: RequestRow[], employeeId: string, date: string) {
  return requests.find(r => {
    if (String(r.employeeId || "") !== String(employeeId)) return false;
    if (r.status !== "approved" && r.status !== "confirmed") return false;
    const start = String(r.startDate || r.createdAt || "").slice(0, 10);
    const end = String(r.endDate || start).slice(0, 10);
    return !!start && date >= start && date <= end;
  });
}
function requestText(requests: RequestRow[], employeeId: string, date: string) {
  const r = approvedRequestFor(requests, employeeId, date);
  if (!r) return "";
  const label = r.type === "leave" ? "إجازة" : r.type === "permission" ? "استئذان" : "انصراف مبكر";
  const reason = String(r.reason || "").trim();
  return `${label}${reason ? ` — ${reason}` : ""}`;
}
function dailyStatusFor(row: DailyStatusRow | undefined): Status | null {
  if (!row) return null;
  switch (row.status) {
    case "PRESENT": return "present";
    case "LATE": return "late";
    case "ABSENT": return "absent";
    case "REST": return "off";
    case "LEAVE": return "leave";
    case "PERMISSION": return "permission";
    case "NOT_STARTED": return "not_started";
    default: return null;
  }
}

function calculateDetails(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatus?: Map<string, DailyStatusRow>): DayRow[] {
  const detail: DayRow[] = [];
  for (const d of dates) {
    const w = getEmployeeWorkPeriod(employee, d), k = key(d), req = approvedRequestFor(requests, employee.id, k);
    if (!w.isWorkDay) { detail.push({ date: k, day: days[d.getDay()], status: "off", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: w.detail || "لا يوجد دوام" }); continue; }
    if (req?.type === "leave") { detail.push({ date: k, day: days[d.getDay()], status: "leave", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: requestText(requests, employee.id, k) }); continue; }
    if (req?.type === "permission") { detail.push({ date: k, day: days[d.getDay()], status: "permission", checkIn: "—", checkOut: "—", worked: 0, late: 0, early: 0, detail: requestText(requests, employee.id, k) }); continue; }
    const s = index.get(`${employee.id}|${k}`), dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = s?.in?.timestamp || dailyRow?.checkInAt || null, coutValue = s?.out?.timestamp || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;
    let st: Status = "absent", lm = 0, em = 0, wd = 0;
    if (cin) {
      lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0;
      if (cout) { wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())); em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0; st = em ? "early" : lm ? "late" : "present"; }
      else st = "open";
    }
    if (dailyStatus && serverStatus) st = serverStatus;
    detail.push({ date: k, day: days[d.getDay()], status: st, checkIn: cin ? formatTime(cin.toISOString()) : "—", checkOut: cout ? formatTime(cout.toISOString()) : "—", worked: wd, late: lm, early: em, detail: [w.detail || "يوم عمل", requestText(requests, employee.id, k)].filter(Boolean).join(" · ") });
  }
  return detail;
}
function calculateSummary(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatus?: Map<string, DailyStatusRow>): Summary {
  let workDays = 0, present = 0, absent = 0, early = 0, late = 0, open = 0, permission = 0, leave = 0, off = 0, worked = 0, lateMinutes = 0, earlyMinutes = 0;
  for (const d of dates) {
    const w = getEmployeeWorkPeriod(employee, d), k = key(d), req = approvedRequestFor(requests, employee.id, k);
    if (!w.isWorkDay) { off++; continue; }
    workDays++;
    if (req?.type === "leave") { leave++; continue; }
    if (req?.type === "permission") { permission++; continue; }
    const s = index.get(`${employee.id}|${k}`), dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = s?.in?.timestamp || dailyRow?.checkInAt || null, coutValue = s?.out?.timestamp || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;
    if (serverStatus === "not_started") continue;
    if (serverStatus === "off") { off++; continue; }
    if (serverStatus === "leave") { leave++; continue; }
    if (serverStatus === "permission") { permission++; continue; }
    if (serverStatus === "absent") { absent++; continue; }
    if (!cin) { absent++; continue; }
    const lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0; lateMinutes += lm;
    if (!cout) { open++; late += lm ? 1 : 0; continue; }
    const wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())); worked += wd;
    const em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0; earlyMinutes += em;
    if (serverStatus === "late") late++; else if (serverStatus === "early" || em) early++; else if (serverStatus === "present") present++; else if (em) early++; else if (lm) late++; else present++;
  }
  return { employee, workDays, present, absent, early, late, open, permission, leave, off, worked, lateMinutes, earlyMinutes };
}
function specialtyOf(e: Employee) { return (e.specialties || []).map(x => String(x).trim()).filter(Boolean)[0] || "غير محدد"; }
function serviceRows(summaries: Summary[], dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, settings: ReturnType<typeof getSettings>, requests: RequestRow[], dailyStatus?: Map<string, DailyStatusRow>) {
  return summaries.map(s => { const d = calculateDetails(s.employee, dates, index, settings, requests, dailyStatus)[0]; return { employee: s.employee, specialty: specialtyOf(s.employee), status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, note: d.detail }; });
}

export default function ManagerReports() {
  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));
  const [employees, setEmployees] = useState<Employee[]>(getEmployees()), [audit, setAudit] = useState<Audit[]>([]), [requests, setRequests] = useState<RequestRow[]>([]), [dailyStatus, setDailyStatus] = useState<DailyStatusRow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);
  const settings = getSettings();
  useEffect(() => { let stop = false; const load = async () => { setLoading(true); setError(null); const e: string[] = []; try { const x = await getBackendEmployees(); if (!stop && Array.isArray(x)) setEmployees(x); } catch (x) { e.push(`الموظفون: ${x instanceof Error ? x.message : "فشل الجلب"}`); } try { const x = await getBackendAudit(2000); if (!stop && Array.isArray(x)) setAudit(x as Audit[]); } catch (x) { e.push(`الحضور: ${x instanceof Error ? x.message : "فشل الجلب"}`); } try { const x = await getBackendRequests("admin"); if (!stop && Array.isArray(x)) setRequests(x as RequestRow[]); } catch (x) { e.push(`الطلبات: ${x instanceof Error ? x.message : "فشل الجلب"}`); } try { const x = await getDailyStatus(date); if (!stop && Array.isArray(x.employees)) setDailyStatus(x.employees); } catch (x) { e.push(`الحالة اليومية: ${x instanceof Error ? x.message : "فشل الجلب"}`); } if (!stop) { setLoading(false); if (e.length) setError(e.join(" · ")); } }; void load(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60000); return () => { stop = true; clearInterval(t); }; }, [date]);
  const period = mode === "daily" ? date : mode === "monthly" ? month : year;
  const dates = useMemo(() => range(mode, period), [mode, period]);
  const index = useMemo(() => auditIndex(audit), [audit]);
  const dailyStatusMap = useMemo(() => new Map(dailyStatus.map(row => [row.employeeId, row])), [dailyStatus]);
  const calculatedSummaries = useMemo(() => employees.map(employee => calculateSummary(employee, dates, index, settings, requests, mode === "daily" ? dailyStatusMap : undefined)), [employees, dates, index, settings, requests, mode, dailyStatusMap]);
  const summaries = useMemo(() => mode === "daily" ? calculatedSummaries.filter(s => s.workDays > 0) : calculatedSummaries, [calculatedSummaries, mode]);
  const expandedEmployee = useMemo(() => expanded ? summaries.find(s => s.employee.id === expanded)?.employee : null, [expanded, summaries]);
  const expandedDays = useMemo(() => expandedEmployee ? calculateDetails(expandedEmployee, dates, index, settings, requests, mode === "daily" ? dailyStatusMap : undefined) : [], [expandedEmployee, dates, index, settings, requests, mode, dailyStatusMap]);
  const total = useMemo(() => summaries.reduce((a, s) => ({ present: a.present + s.present, absent: a.absent + s.absent, early: a.early + s.early, late: a.late + s.late, open: a.open + s.open, permission: a.permission + s.permission, leave: a.leave + s.leave, off: a.off + s.off }), { present: 0, absent: 0, early: 0, late: 0, open: 0, permission: 0, leave: 0, off: 0 }), [summaries]);
  const chartData = [{ label: "حاضر", value: total.present }, { label: "غياب", value: total.absent }, { label: "استئذان", value: total.permission }, { label: "إجازة", value: total.leave }, { label: "انصراف مبكر", value: total.early }, { label: "تأخر", value: total.late }, { label: "تسجيل ناقص", value: total.open }], max = Math.max(1, ...chartData.map(x => x.value));
  const dailyServiceRows = useMemo(() => mode === "daily" ? serviceRows(summaries, dates, index, settings, requests, dailyStatusMap) : [], [mode, summaries, dates, index, settings, requests, dailyStatusMap]);
  const groups = useMemo(() => { const map = new Map<string, ServiceRow[]>(); for (const row of dailyServiceRows) { const list = map.get(row.specialty) || []; list.push(row); map.set(row.specialty, list); } const grouped = Array.from(map.entries()).map(([name, rows]) => ({ name, rows })); const specialtyOrder = (settings.specialties || []).map(x => String(x).trim()).filter(Boolean); const rank = new Map(specialtyOrder.map((name, index) => [name, index])); return grouped.sort((a, b) => { const ai = rank.get(a.name), bi = rank.get(b.name); if (ai !== undefined && bi !== undefined) return ai - bi; if (ai !== undefined) return -1; if (bi !== undefined) return 1; return 0; }); }, [dailyServiceRows, settings.specialties]);
  const groupColumns = useMemo(() => { const out: { name: string; rows: ServiceRow[] }[][] = []; for (let i = 0; i < groups.length; i += 2) out.push([groups[i], groups[i + 1]].filter(Boolean) as { name: string; rows: ServiceRow[] }[]); return out; }, [groups]);
  const exportCsv = () => { const h = ["اسم الشركة", "الاختصاص", "الموظف", "الرقم الوظيفي", "التاريخ", "اليوم", "الحالة", "وقت الحضور", "وقت الانصراف", "مدة العمل", "دقائق التأخر", "دقائق الانصراف المبكر", "تفصيل اليوم"], d = summaries.flatMap(s => calculateDetails(s.employee, dates, index, settings, requests, mode === "daily" ? dailyStatusMap : undefined).map(day => [String(settings.brandName || "HADIR").trim() || "HADIR", specialtyOf(s.employee), s.employee.name, s.employee.jobNumber, day.date, day.day, labels[day.status], day.checkIn, day.checkOut, formatDurationMinutes(day.worked), day.late, day.early, day.detail] as CsvCell[])); downloadCSV(`Hadir-${mode}-${period}-attendance`, h, d); };
  const exportExcel = () => { const sourceRows = mode === "daily" ? groups.flatMap(group => group.rows) : summaries.map(s => ({ employee: s.employee, specialty: specialtyOf(s.employee) })); const dailyRows = sourceRows.flatMap(row => { const employee = row.employee, details = calculateDetails(employee, dates, index, settings, requests, mode === "daily" ? dailyStatusMap : undefined); return details.map(day => ({ employee: employee.name, jobNumber: employee.jobNumber, specialty: specialtyOf(employee), date: day.date, day: day.day, status: labels[day.status], checkIn: day.checkIn, checkOut: day.checkOut, worked: formatDurationMinutes(day.worked), late: day.late, early: day.early, detail: day.detail })); }); const absenceRows = dailyRows.filter(row => row.status === "غياب"); downloadProfessionalAttendanceReport({ mode, period, generatedAt: new Date().toLocaleString("ar-EG"), summaries, dailyRows, absenceRows, chartData }); };
  const title = mode === "daily" ? `يومي · ${formatDate(date)}` : mode === "monthly" ? `شهري · ${month}` : `سنوي · ${year}`;
  const printReport = () => window.print();

  return <ManagerLayout title="التقارير" subtitle={title} actions={<div className="flex flex-wrap gap-2"><Button onClick={exportExcel} disabled={!summaries.length}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>{mode === "daily" && <Button variant="outline" onClick={printReport} disabled={!summaries.length}><Printer className="ml-2 h-4 w-4" />طباعة الخدمة</Button>}</div>}>
    <div className="hud-card p-4 mb-5 space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-secondary/50 p-1 border border-border/50">{(["daily", "monthly", "annual"] as Mode[]).map(v => <button key={v} onClick={() => { setMode(v); setExpanded(null); }} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${mode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{v === "daily" ? "يومي" : v === "monthly" ? "شهري" : "سنوي"}</button>)}</div>{mode === "daily" && <input aria-label="تاريخ التقرير" type="date" className="input w-auto max-w-full" value={date} max={new Date().toISOString().slice(0, 10)} onChange={e => { setDate(e.target.value); setExpanded(null); }} />}{mode === "monthly" && <input aria-label="شهر التقرير" type="month" className="input w-auto max-w-full" value={month} max={new Date().toISOString().slice(0, 7)} onChange={e => { setMonth(e.target.value); setExpanded(null); }} />}{mode === "annual" && <input aria-label="سنة التقرير" type="number" className="input w-32 max-w-full" min="2000" max={new Date().getFullYear()} value={year} onChange={e => { setYear(e.target.value); setExpanded(null); }} />}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">{chartData.map(x => <div key={x.label} className="rounded-xl border p-3 min-w-0"><div className="text-xs text-muted-foreground truncate">{x.label}</div><div className="text-2xl font-black">{x.value}</div></div>)}</div>
      <div className="rounded-2xl border bg-background/50 p-4"><div className="flex items-center gap-2 mb-4 font-black"><BarChart3 className="h-5 w-5 text-primary" />تحليل الحضور والمخالفات</div><div className="space-y-3">{chartData.map(x => <div key={x.label} className="grid grid-cols-[minmax(95px,120px)_minmax(0,1fr)_40px] items-center gap-3 text-sm"><span className="font-bold truncate" title={x.label}>{x.label}</span><div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(x.value / max * 100)}%` }} /></div><span className="mono text-left">{x.value}</span></div>)}</div></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Database className="h-4 w-4 text-primary" /><span>مصدر التقرير: D1 — الموظفون والحضور والطلبات.</span>{loading && <><Loader2 className="h-3 w-3 animate-spin" />جاري القراءة من D1...</>}</div>{error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    </div>

    {mode === "daily" ? <section className="service-report bg-white text-black rounded-none border shadow-sm print:border-0 print:shadow-none" dir="rtl">
      <div className="p-5 md:p-7 border-b-2 border-black/70 text-center">
        <div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-bold"><div>رئيس القسم : {settings.ownerName || "—"}</div><div>معاون رئيس القسم : {settings.managerName || "—"}</div></div>
      </div>
      <div className="p-3 md:p-5 space-y-4">{groupColumns.length ? groupColumns.map((pair, pi) => <div key={pi} className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {pair.map((group, gi) => <div key={group.name} className="border-2 border-black/70 overflow-hidden bg-white">
          <div className="bg-slate-100 border-b-2 border-black/70 px-3 py-2 text-center font-black">{group.name}</div>
          <table className="w-full table-fixed text-[11px] md:text-xs"><colgroup><col className="w-[8%]" /><col className="w-[22%]" /><col className="w-[34%]" /><col className="w-[36%]" /></colgroup><thead><tr className="border-b border-black/50"><th className="p-2 border-l border-black/30">ت</th><th className="p-2 border-l border-black/30">الصفة</th><th className="p-2 border-l border-black/30">الاسم</th><th className="p-2">ملاحظات</th></tr></thead><tbody>{group.rows.map((row, i) => <tr key={row.employee.id} className="border-b border-black/20 last:border-0 align-middle"><td className="p-2 border-l border-black/20 text-center font-bold">{i + 1}</td><td className="p-2 border-l border-black/20 font-semibold break-words">{specialtyOf(row.employee)}</td><td className="p-2 border-l border-black/20 font-bold break-words">{row.employee.name}<div className="font-normal text-[10px] mt-0.5">{row.employee.jobNumber}</div></td><td className="p-2 break-words"><span className={`inline-flex rounded-full px-1.5 py-0.5 font-bold ${cls[row.status]}`}>{labels[row.status]}</span>{row.checkIn !== "—" && <span className="mr-1">حضور {row.checkIn}</span>}{row.checkOut !== "—" && <span className="mr-1">انصراف {row.checkOut}</span>}{row.note && <div className="mt-1 text-[10px] leading-4">{row.note}</div>}</td></tr>)}</tbody></table>
        </div>)}
      </div>) : <div className="py-16 text-center text-muted-foreground">لا يوجد موظفون لديهم عمل في هذا التاريخ.</div>}
      <div className="mt-4 border-t-2 border-black/70 pt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold"><div>عدد العاملين: {summaries.length}</div><div>حاضر: {total.present}</div><div>غياب: {total.absent}</div><div>استئذان/إجازة: {total.permission + total.leave}</div></div>
      </div>
    </section> : <div className="hud-card overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] table-auto text-sm"><thead className="bg-secondary/50 text-xs"><tr>{["", "الموظف", "الرقم", "الاختصاص", "عمل", "حاضر", "غياب", "إذن", "إجازة", "مبكر", "تأخر", "ناقص", "ساعات العمل"].map((h, i) => <th key={i} className="px-3 py-3 text-right whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{summaries.map(s => <><tr key={s.employee.id} className="border-t align-middle"><td className="px-3 py-3">{s.absent || s.early ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : null}</td><td className="px-3 py-3 font-bold"><button type="button" className="flex w-full min-w-0 items-center gap-2 text-right" onClick={() => setExpanded(expanded === s.employee.id ? null : s.employee.id)}>{expanded === s.employee.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}<span className="min-w-0 whitespace-normal break-words leading-6">{s.employee.name}</span></button></td><td className="px-3 py-3 mono whitespace-nowrap">{s.employee.jobNumber}</td><td className="px-3 py-3 whitespace-nowrap">{specialtyOf(s.employee)}</td><td className="px-3 py-3">{s.workDays}</td><td className="px-3 py-3 text-emerald-700 font-bold">{s.present}</td><td className="px-3 py-3 text-red-700 font-bold">{s.absent}</td><td className="px-3 py-3 text-sky-700 font-bold">{s.permission}</td><td className="px-3 py-3 text-violet-700 font-bold">{s.leave}</td><td className="px-3 py-3 text-orange-700 font-bold">{s.early}</td><td className="px-3 py-3 text-amber-700 font-bold">{s.late}</td><td className="px-3 py-3 text-yellow-700 font-bold">{s.open}</td><td className="px-3 py-3 mono whitespace-nowrap">{formatDurationMinutes(s.worked)}</td></tr>{expanded === s.employee.id && <tr key={`${s.employee.id}-details`}><td colSpan={13} className="p-0"><div className="p-4 bg-secondary/20 border-t"><div className="flex flex-wrap gap-2 mb-3 text-xs font-bold"><span className="inline-flex items-center gap-1"><UserX className="h-3 w-3 text-red-600" />الغياب: <span>{expandedDays.filter(d => d.status === "absent").map(d => d.date).join("، ") || "لا يوجد"}</span></span><span className="inline-flex items-center gap-1"><LogOut className="h-3 w-3 text-orange-600" />الانصراف المبكر: <span>{expandedDays.filter(d => d.status === "early").map(d => `${d.date} (${d.early} د)`).join("، ") || "لا يوجد"}</span></span></div><div className="overflow-x-auto"><table className="w-full min-w-[950px] table-auto text-xs"><thead><tr className="border-b">{["التاريخ", "اليوم", "الحالة", "الحضور", "الانصراف", "العمل", "التأخر", "المبكر", "التفصيل"].map(h => <th key={h} className="px-2 py-2 text-right whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{expandedDays.map(d => <tr key={d.date} className="border-b border-border/40"><td className="px-2 py-2 mono">{d.date}</td><td className="px-2 py-2">{d.day}</td><td className="px-2 py-2"><span className={`inline-flex rounded-full px-2 py-1 font-bold ${cls[d.status]}`}>{labels[d.status]}</span></td><td className="px-2 py-2 mono">{d.checkIn}</td><td className="px-2 py-2 mono">{d.checkOut}</td><td className="px-2 py-2 mono">{formatDurationMinutes(d.worked)}</td><td className="px-2 py-2 mono">{d.late ? `${d.late} د` : "—"}</td><td className="px-2 py-2 mono">{d.early ? `${d.early} د` : "—"}</td><td className="px-2 py-2 max-w-[250px] break-words">{d.detail}</td></tr>)}</tbody></table></div></div></td></tr>}</>)}</tbody></table></div>
      {loading && !summaries.length && <div className="p-10 text-center text-muted-foreground">جاري تحميل التقرير من D1…</div>}{!loading && !summaries.length && <div className="p-10 text-center text-muted-foreground">لا توجد بيانات موظفين في D1.</div>}
    </div>}
    <style>{`
      @page { size: A4 landscape; margin: 6mm; }
      @media print {
        html, body { width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .service-report { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
        .service-report > div { break-inside: auto; page-break-inside: auto; }
        .service-report table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
        .service-report thead { display: table-header-group; }
        .service-report tbody { display: table-row-group; }
        .service-report tr { break-inside: avoid; page-break-inside: avoid; }
        .service-report th, .service-report td { break-inside: avoid; }
        .service-report img { max-height: 42px !important; }
        .service-report .grid { break-inside: auto; }
        .service-report .border-2 { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
  </ManagerLayout>;
}
