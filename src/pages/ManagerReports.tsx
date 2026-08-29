import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getEmployees, getSettings } from "@/lib/storage";
import { getBackendAudit, getBackendEmployees, getBackendRequests } from "@/lib/backend";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import { formatDate, formatDurationMinutes, formatTime, minutesBetween } from "@/lib/utils";
import { FileSpreadsheet, FileText, Database, Loader2, ChevronDown, ChevronUp, AlertTriangle, UserX, LogOut, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import type { Employee } from "@/types";
import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";

type Mode = "daily" | "monthly" | "annual";
type Status = "present" | "late" | "absent" | "early" | "open" | "off" | "leave" | "permission" | "pending";
type Audit = { id?: string | number; employeeId?: string; action?: string; result?: string; timestamp?: string; jobNumber?: string; actorName?: string; employeeName?: string };
type ReportRequest = { employeeId?: string; type?: string; status?: string; createdAt?: string; startDate?: string; endDate?: string; start_date?: string; end_date?: string };
type DayRow = { date: string; day: string; status: Status; checkIn: string; checkOut: string; worked: number; late: number; early: number; detail: string };
type Summary = { employee: Employee; workDays: number; present: number; absent: number; early: number; late: number; open: number; off: number; leave: number; permission: number; pending: number; worked: number; lateMinutes: number; earlyMinutes: number };

const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const labels: Record<Status, string> = { present: "حاضر", late: "متأخر", absent: "غياب", early: "انصراف مبكر", open: "تسجيل ناقص", off: "راحة/عطلة", leave: "إجازة", permission: "إذن", pending: "بانتظار الدوام" };
const cls: Record<Status, string> = { present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", late: "bg-amber-500/15 text-amber-700 dark:text-amber-300", absent: "bg-red-500/15 text-red-700 dark:text-red-300", early: "bg-orange-500/15 text-orange-700 dark:text-orange-300", open: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300", off: "bg-secondary text-muted-foreground", leave: "bg-sky-500/15 text-sky-700 dark:text-sky-300", permission: "bg-violet-500/15 text-violet-700 dark:text-violet-300", pending: "bg-secondary text-muted-foreground" };

function key(value: string | Date) { const d = typeof value === "string" ? new Date(value) : value; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dateOf(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function todayLocal() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
function range(mode: Mode, period: string) {
  const today = todayLocal();
  if (mode === "daily") { const d = dateOf(period); return d <= today ? [d] : []; }
  if (mode === "monthly") { const [y, m] = period.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return Array.from({ length: last }, (_, i) => new Date(y, m - 1, i + 1, 12)).filter((d) => d <= today); }
  const y = Number(period), result: Date[] = [];
  for (let m = 0; m < 12; m += 1) { const last = new Date(y, m + 1, 0).getDate(); for (let d = 1; d <= last; d += 1) { const date = new Date(y, m, d, 12); if (date <= today) result.push(date); } }
  return result;
}
function auditIndex(audits: Audit[]) {
  const result = new Map<string, { in?: Audit; out?: Audit }>();
  for (const audit of audits) {
    if (audit.result !== "success" || !audit.employeeId || !audit.timestamp) continue;
    if (audit.action !== "check-in" && audit.action !== "check-out") continue;
    const k = `${audit.employeeId}|${key(audit.timestamp)}`, current = result.get(k) || {};
    if (audit.action === "check-in" && (!current.in || new Date(audit.timestamp) < new Date(current.in.timestamp!))) current.in = audit;
    if (audit.action === "check-out" && (!current.out || new Date(audit.timestamp) > new Date(current.out.timestamp!))) current.out = audit;
    result.set(k, current);
  }
  return result;
}
function employeeStartKey(employee: Employee) { if (!employee.createdAt) return null; const date = new Date(employee.createdAt); return Number.isNaN(date.getTime()) ? null : key(date); }
function requestIndex(requests: ReportRequest[]) {
  const result = new Map<string, { leave?: ReportRequest; permission?: ReportRequest }>();
  for (const request of requests) {
    if (String(request.status || "").toLowerCase() !== "approved" || !request.employeeId) continue;
    const type = String(request.type || "").toLowerCase();
    if (type === "permission") { const date = String(request.createdAt || "").slice(0, 10); if (date) result.set(`${request.employeeId}|${date}`, { ...(result.get(`${request.employeeId}|${date}`) || {}), permission: request }); continue; }
    if (type === "leave") {
      const start = String(request.startDate || request.start_date || request.createdAt || "").slice(0, 10), end = String(request.endDate || request.end_date || start).slice(0, 10);
      if (!start) continue;
      const from = dateOf(start), to = dateOf(end || start);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) { const k = `${request.employeeId}|${key(d)}`; result.set(k, { ...(result.get(k) || {}), leave: request }); }
    }
  }
  return result;
}
function dayState(employee: Employee, date: Date, index: Map<string, { in?: Audit; out?: Audit }>, requests: Map<string, { leave?: ReportRequest; permission?: ReportRequest }>, settings: ReturnType<typeof getSettings>) {
  const dateKey = key(date), createdKey = employeeStartKey(employee);
  if (createdKey && dateKey < createdKey) return { status: "pending" as Status, cin: null, cout: null, lm: 0, em: 0, wd: 0, detail: "قبل إنشاء حساب الموظف — خارج نطاق التقرير" };
  const work = getEmployeeWorkPeriod(employee, date);
  if (!work.isWorkDay) return { status: "off" as Status, cin: null, cout: null, lm: 0, em: 0, wd: 0, detail: work.detail || work.label || "لا يوجد دوام" };
  const request = requests.get(`${employee.id}|${dateKey}`);
  if (request?.leave) return { status: "leave" as Status, cin: null, cout: null, lm: 0, em: 0, wd: 0, detail: "إجازة معتمدة" };
  if (request?.permission) return { status: "permission" as Status, cin: null, cout: null, lm: 0, em: 0, wd: 0, detail: "إذن معتمد" };
  const records = index.get(`${employee.id}|${dateKey}`), grace = Math.max(0, employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10);
  const cin = records?.in?.timestamp ? new Date(records.in.timestamp) : null, cout = records?.out?.timestamp ? new Date(records.out.timestamp) : null;
  const lm = cin && work.start ? Math.max(0, Math.round((cin.getTime() - work.start.getTime()) / 60000) - grace) : 0;
  const em = cout && work.end ? Math.max(0, Math.round((work.end.getTime() - cout.getTime()) / 60000)) : 0;
  const wd = cin && cout ? Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())) : 0;
  const now = new Date(), isToday = dateKey === key(now), beforeEnd = Boolean(isToday && work.end && now.getTime() < work.end.getTime());
  let status: Status;
  if (cin && cout) status = em > 0 ? "early" : lm > 0 ? "late" : "present";
  else if (cin) status = "open";
  else status = beforeEnd ? "pending" : "absent";
  return { status, cin, cout, lm: status === "late" ? lm : 0, em: status === "early" ? em : 0, wd, detail: status === "pending" ? "يوم عمل مجدول ولم ينتهِ وقت الدوام بعد" : work.detail || "يوم عمل" };
}
function calculateSummary(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, requests: Map<string, { leave?: ReportRequest; permission?: ReportRequest }>, settings: ReturnType<typeof getSettings>): Summary {
  let workDays = 0, present = 0, absent = 0, early = 0, late = 0, open = 0, off = 0, leave = 0, permission = 0, pending = 0, worked = 0, lateMinutes = 0, earlyMinutes = 0;
  for (const date of dates) {
    const row = dayState(employee, date, index, requests, settings);
    if (row.status === "pending" && row.detail.startsWith("قبل إنشاء")) continue;
    if (row.status === "off") { off += 1; continue; }
    if (row.status === "leave") { leave += 1; continue; }
    if (row.status === "permission") { permission += 1; continue; }
    if (row.status === "pending") { workDays += 1; pending += 1; continue; }
    workDays += 1;
    if (row.status === "late") { late += 1; lateMinutes += row.lm; }
    else if (row.status === "early") { early += 1; earlyMinutes += row.em; }
    else if (row.status === "absent") absent += 1;
    else if (row.status === "open") open += 1;
    else if (row.status === "present") present += 1;
    worked += row.wd;
  }
  return { employee, workDays, present, absent, early, late, open, off, leave, permission, pending, worked, lateMinutes, earlyMinutes };
}
function calculateDetails(employee: Employee, dates: Date[], index: Map<string, { in?: Audit; out?: Audit }>, requests: Map<string, { leave?: ReportRequest; permission?: ReportRequest }>, settings: ReturnType<typeof getSettings>): DayRow[] {
  return dates.map((date) => { const row = dayState(employee, date, index, requests, settings); return { date: key(date), day: days[date.getDay()], status: row.status, checkIn: row.cin ? formatTime(row.cin.toISOString()) : "—", checkOut: row.cout ? formatTime(row.cout.toISOString()) : "—", worked: row.wd, late: row.lm, early: row.em, detail: row.detail }; });
}

export default function ManagerReports() {
  const [mode, setMode] = useState<Mode>("monthly"), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [month, setMonth] = useState(new Date().toISOString().slice(0, 7)), [year, setYear] = useState(String(new Date().getFullYear()));
  const [employees, setEmployees] = useState<Employee[]>(getEmployees()), [audit, setAudit] = useState<Audit[]>([]), [requests, setRequests] = useState<ReportRequest[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);
  const settings = getSettings();
  useEffect(() => { let stopped = false; const load = async () => { setLoading(true); setError(null); const errors: string[] = []; try { const result = await getBackendEmployees(); if (!stopped && Array.isArray(result)) setEmployees(result); } catch (err) { errors.push(`الموظفون: ${err instanceof Error ? err.message : "فشل الجلب"}`); } try { const result = await getBackendAudit(2000); if (!stopped && Array.isArray(result)) setAudit(result as Audit[]); } catch (err) { errors.push(`الحضور: ${err instanceof Error ? err.message : "فشل الجلب"}`); } try { const result = await getBackendRequests("admin"); if (!stopped && Array.isArray(result)) setRequests(result as ReportRequest[]); } catch (err) { errors.push(`الإجازات والأذونات: ${err instanceof Error ? err.message : "فشل الجلب"}`); } if (!stopped) { setLoading(false); if (errors.length) setError(errors.join(" · ")); } }; void load(); const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60000); return () => { stopped = true; clearInterval(timer); }; }, []);
  const period = mode === "daily" ? date : mode === "monthly" ? month : year;
  const dates = useMemo(() => range(mode, period), [mode, period]), index = useMemo(() => auditIndex(audit), [audit]), requestMap = useMemo(() => requestIndex(requests), [requests]);
  const summaries = useMemo(() => employees.map((employee) => calculateSummary(employee, dates, index, requestMap, settings)), [employees, dates, index, requestMap, settings]);
  const expandedEmployee = useMemo(() => expanded ? summaries.find((summary) => summary.employee.id === expanded)?.employee : null, [expanded, summaries]);
  const expandedDays = useMemo(() => expandedEmployee ? calculateDetails(expandedEmployee, dates, index, requestMap, settings) : [], [expandedEmployee, dates, index, requestMap, settings]);
  const total = useMemo(() => summaries.reduce((acc, summary) => ({ present: acc.present + summary.present, absent: acc.absent + summary.absent, early: acc.early + summary.early, late: acc.late + summary.late, open: acc.open + summary.open, off: acc.off + summary.off, leave: acc.leave + summary.leave, permission: acc.permission + summary.permission }), { present: 0, absent: 0, early: 0, late: 0, open: 0, off: 0, leave: 0, permission: 0 }), [summaries]);
  const chartData = [{ label: "حاضر", value: total.present }, { label: "غياب", value: total.absent }, { label: "انصراف مبكر", value: total.early }, { label: "تأخر", value: total.late }, { label: "تسجيل ناقص", value: total.open }, { label: "إجازة", value: total.leave }, { label: "إذن", value: total.permission }], max = Math.max(1, ...chartData.map((item) => item.value));
  const exportCsv = () => { const headers = ["الموظف", "الرقم الوظيفي", "التاريخ", "اليوم", "الحالة", "وقت الحضور", "وقت الانصراف", "مدة العمل", "دقائق التأخر", "دقائق الانصراف المبكر", "تفصيل اليوم"]; const rows = summaries.flatMap((summary) => calculateDetails(summary.employee, dates, index, requestMap, settings).map((day) => [summary.employee.name, summary.employee.jobNumber, day.date, day.day, labels[day.status], day.checkIn, day.checkOut, formatDurationMinutes(day.worked), day.late, day.early, day.detail] as CsvCell[])); downloadCSV(`Hadir-${mode}-${period}-attendance`, headers, rows); };
  const exportExcel = () => { const dailyRows = summaries.flatMap((summary) => calculateDetails(summary.employee, dates, index, requestMap, settings).map((day) => ({ employee: summary.employee.name, jobNumber: summary.employee.jobNumber, date: day.date, day: day.day, status: labels[day.status], checkIn: day.checkIn, checkOut: day.checkOut, worked: formatDurationMinutes(day.worked), late: day.late, early: day.early, detail: day.detail }))); const absenceRows = dailyRows.filter((row) => row.status === "غياب"); downloadProfessionalAttendanceReport({ mode, period, generatedAt: new Date().toLocaleString("ar-EG"), summaries, dailyRows, absenceRows, chartData }); };
  const title = mode === "daily" ? `يومي · ${formatDate(date)}` : mode === "monthly" ? `شهري · ${month}` : `سنوي · ${year}`;
  return <ManagerLayout title="التقارير" subtitle={title} actions={<div className="flex flex-wrap gap-2"><Button onClick={exportExcel} disabled={!summaries.length}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={exportCsv} disabled={!summaries.length}><FileText className="ml-2 h-4 w-4" />CSV</Button></div>}>
    <div className="hud-card p-4 mb-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-secondary/50 p-1 border border-border/50">{(["daily", "monthly", "annual"] as Mode[]).map((value) => { const label = value === "daily" ? "يومي" : value === "monthly" ? "شهري" : "سنوي"; return <button key={value} onClick={() => { setMode(value); setExpanded(null); }} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>; })}</div>{mode === "daily" && <input aria-label="تاريخ التقرير" type="date" className="input w-auto max-w-full" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => { setDate(event.target.value); setExpanded(null); }} />}{mode === "monthly" && <input aria-label="شهر التقرير" type="month" className="input w-auto max-w-full" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(event) => { setMonth(event.target.value); setExpanded(null); }} />}{mode === "annual" && <input aria-label="سنة التقرير" type="number" className="input w-32 max-w-full" min="2000" max={new Date().getFullYear()} value={year} onChange={(event) => { setYear(event.target.value); setExpanded(null); }} />}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{chartData.map((item) => <div key={item.label} className="rounded-xl border p-3 min-w-0"><div className="text-xs text-muted-foreground truncate">{item.label}</div><div className="text-2xl font-black">{item.value}</div></div>)}</div>
      <div className="rounded-2xl border bg-background/50 p-4"><div className="flex items-center gap-2 mb-4 font-black"><BarChart3 className="h-5 w-5 text-primary" />تحليل الحضور والمخالفات</div><div className="space-y-3">{chartData.map((item) => <div key={item.label} className="grid grid-cols-[minmax(95px,120px)_minmax(0,1fr)_40px] items-center gap-3 text-sm"><span className="font-bold truncate" title={item.label}>{item.label}</span><div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(item.value / max * 100)}%` }} /></div><span className="mono text-left">{item.value}</span></div>)}</div><div className="mt-3 text-xs text-muted-foreground">لا يُحتسب اليوم كغياب قبل نهاية الدوام، ولا تُحتسب التواريخ السابقة لإنشاء حساب الموظف، ولا تُحتسب الإجازات والأذونات المعتمدة كغياب.</div></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Database className="h-4 w-4 text-primary" /><span>مصدر التقرير: D1 — الموظفون والحضور والأذونات والإجازات المعتمدة.</span>{loading && <><Loader2 className="h-3 w-3 animate-spin" />جاري القراءة من D1...</>}</div>{error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    </div>
    <div className="hud-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1260px] table-auto text-sm"><thead className="bg-secondary/50 text-xs"><tr>{["", "الموظف", "الرقم", "عمل", "حاضر", "غياب", "مبكر", "تأخر", "ناقص", "إجازة", "إذن", "ساعات العمل"].map((header) => <th key={header} className="px-3 py-3 text-right whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{summaries.map((summary) => <>
      <tr key={summary.employee.id} className="border-t align-middle"><td className="px-3 py-3">{summary.absent || summary.early ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : null}</td><td className="px-3 py-3 font-bold align-middle"><button type="button" className="flex w-full min-w-0 items-center gap-2 text-right" onClick={() => setExpanded(expanded === summary.employee.id ? null : summary.employee.id)}>{expanded === summary.employee.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}<span className="min-w-0 whitespace-normal break-words leading-6" title={summary.employee.name}>{summary.employee.name}</span></button></td><td className="px-3 py-3 mono whitespace-nowrap">{summary.employee.jobNumber}</td><td className="px-3 py-3 whitespace-nowrap">{summary.workDays}</td><td className="px-3 py-3 text-emerald-700 font-bold whitespace-nowrap">{summary.present}</td><td className="px-3 py-3 text-red-700 font-bold whitespace-nowrap">{summary.absent}</td><td className="px-3 py-3 text-orange-700 font-bold whitespace-nowrap">{summary.early}</td><td className="px-3 py-3 text-amber-700 font-bold whitespace-nowrap">{summary.late}</td><td className="px-3 py-3 text-yellow-700 font-bold whitespace-nowrap">{summary.open}</td><td className="px-3 py-3 text-sky-700 font-bold whitespace-nowrap">{summary.leave}</td><td className="px-3 py-3 text-violet-700 font-bold whitespace-nowrap">{summary.permission}</td><td className="px-3 py-3 mono whitespace-nowrap">{formatDurationMinutes(summary.worked)}</td></tr>
      {expanded === summary.employee.id && <tr key={`${summary.employee.id}-details`}><td colSpan={12} className="p-0"><div className="p-4 bg-secondary/20 border-t"><div className="flex flex-wrap gap-2 mb-3 text-xs font-bold"><span className="inline-flex items-center gap-1 max-w-full"><UserX className="h-3 w-3 text-red-600 shrink-0" />الغياب: <span className="break-words">{expandedDays.filter((day) => day.status === "absent").map((day) => day.date).join("، ") || "لا يوجد"}</span></span><span className="inline-flex items-center gap-1 max-w-full"><LogOut className="h-3 w-3 text-orange-600 shrink-0" />الانصراف المبكر: <span className="break-words">{expandedDays.filter((day) => day.status === "early").map((day) => `${day.date} (${day.early} د)`).join("، ") || "لا يوجد"}</span></span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] table-auto text-xs"><thead><tr className="border-b">{["التاريخ", "اليوم", "الحالة", "الحضور", "الانصراف", "العمل", "التأخر", "المبكر", "التفصيل"].map((header) => <th key={header} className="px-2 py-2 text-right whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{expandedDays.map((day) => <tr key={day.date} className="border-b border-border/40"><td className="px-2 py-2 mono whitespace-nowrap">{day.date}</td><td className="px-2 py-2 whitespace-nowrap">{day.day}</td><td className="px-2 py-2"><span className={`inline-flex rounded-full px-2 py-1 font-bold whitespace-nowrap ${cls[day.status]}`}>{labels[day.status]}</span></td><td className="px-2 py-2 mono whitespace-nowrap">{day.checkIn}</td><td className="px-2 py-2 mono whitespace-nowrap">{day.checkOut}</td><td className="px-2 py-2 mono whitespace-nowrap">{formatDurationMinutes(day.worked)}</td><td className="px-2 py-2 mono whitespace-nowrap">{day.late ? `${day.late} د` : "—"}</td><td className="px-2 py-2 mono whitespace-nowrap">{day.early ? `${day.early} د` : "—"}</td><td className="px-2 py-2 max-w-[220px] break-words leading-5" title={day.detail}>{day.detail}</td></tr>)}</tbody></table></div></div></td></tr>}
    </> )}</tbody></table>{loading && !summaries.length && <div className="p-10 text-center text-muted-foreground">جاري تحميل التقرير من D1…</div>}{!loading && !summaries.length && <div className="p-10 text-center text-muted-foreground">لا توجد بيانات موظفين في D1.</div>}</div></div>
  </ManagerLayout>;
}
