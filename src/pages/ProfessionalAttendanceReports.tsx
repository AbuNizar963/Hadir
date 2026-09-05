import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSettings, getEmployees } from "@/lib/storage";
import { getBackendEmployees } from "@/lib/backend";
import { getProfessionalAttendanceReport, type ProfessionalAttendanceReport } from "@/lib/professionalAttendanceReport";
import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";
import { downloadCSV } from "@/lib/csv";
import { BarChart3, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, Printer, RefreshCw, TriangleAlert, Users, UserX } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import type { Employee } from "@/types";

const statusLabels: Record<string, string> = { PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غياب", LEAVE: "إجازة", PERMISSION: "استئذان", REST: "راحة", NOT_STARTED: "لم يبدأ", INVALID: "غير صالح" };
const fmtMinutes = (minutes: number) => `${Math.floor(Math.max(0, minutes) / 60)}س ${Math.round(Math.max(0, minutes) % 60)}د`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(new Date());
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const safePercent = (value: number) => `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;

function Kpi({ title, value, detail, icon: Icon }: { title: string; value: string | number; detail?: string; icon: typeof Users }) {
  return <Card className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-sm text-muted-foreground">{title}</div><div className="mt-2 text-2xl font-black tracking-tight">{value}</div>{detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

export default function ProfessionalAttendanceReports() {
  const initial = today();
  const [from, setFrom] = useState(monthStart(initial));
  const [to, setTo] = useState(initial);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [report, setReport] = useState<ProfessionalAttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "daily" | "employees" | "exceptions">("overview");
  const settings = getSettings();

  const load = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { setError("حدد فترة زمنية صحيحة."); return; }
    setLoading(true); setError(null);
    try { setReport(await getProfessionalAttendanceReport(from, to, employeeId || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل التقرير"); }
    finally { setLoading(false); }
  };

  useEffect(() => { let alive = true; getBackendEmployees().then((rows) => { if (alive && Array.isArray(rows)) setEmployees(rows); }).catch(() => undefined); return () => { alive = false; }; }, []);
  useEffect(() => { void load(); }, []);

  const daily = report?.analytics.dailySeries || [];
  const employeesSummary = report?.analytics.employeeSummaries || [];
  const exceptions = report?.analytics.exceptions || [];
  const topEmployees = useMemo(() => [...employeesSummary].sort((a, b) => (b.lateMinutes + b.absent * 60) - (a.lateMinutes + a.absent * 60)).slice(0, 10), [employeesSummary]);
  const statusData = report ? [
    ["حاضر", report.summary.present], ["متأخر", report.summary.late], ["غياب", report.summary.absent], ["إجازة", report.summary.leave], ["استئذان", report.summary.permission], ["راحة", report.summary.rest]
  ].map(([name, value]) => ({ name, value })) : [];
  const dailyRows = report?.rows || [];

  const exportExcel = () => {
    if (!report) return;
    downloadProfessionalAttendanceReport({
      mode: report.days === 1 ? "daily" : report.days <= 31 ? "monthly" : "annual",
      period: `${report.from} → ${report.to}`,
      generatedAt: report.generatedAt,
      summaries: employeesSummary.map((x) => ({ employee: { name: x.employeeName, jobNumber: x.jobNumber }, workDays: x.days, present: x.present, absent: x.absent, early: 0, late: x.late, open: x.open, off: x.rest, worked: x.workedMinutes })),
      dailyRows: dailyRows.map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: statusLabels[x.status] || x.status, checkIn: x.checkInAt || "—", checkOut: x.checkOutAt || "—", worked: fmtMinutes(x.workedMinutes || 0), late: x.lateMinutes, early: x.earlyLeaveMinutes, detail: x.exceptionCode || "" })),
      chartData: statusData,
      absenceRows: dailyRows.filter((x) => x.status === "ABSENT").map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: "غياب", checkIn: "—", checkOut: "—", worked: "—", late: 0, early: 0, detail: x.exceptionCode || "" })),
    });
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = report.rows.map((x) => [x.attendanceDay, x.employeeName, x.jobNumber || "", statusLabels[x.status] || x.status, x.checkInAt || "", x.checkOutAt || "", fmtMinutes(x.workedMinutes || 0), x.lateMinutes, x.earlyLeaveMinutes, x.overtimeMinutes, x.exceptionCode || ""]);
    downloadCSV(`HADIR-attendance-${report.from}-${report.to}.csv`, [["التاريخ", "الموظف", "الرقم الوظيفي", "الحالة", "الحضور", "الانصراف", "العمل", "التأخر", "الانصراف المبكر", "الإضافي", "الاستثناء"], ...rows]);
  };

  const printReport = () => window.print();

  return <ManagerLayout title="التقارير" subtitle="نظام التقارير العالمي · الحضور والموارد البشرية" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportExcel} disabled={!report}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={exportCsv} disabled={!report}><Download className="ml-2 h-4 w-4" />CSV</Button><Button onClick={printReport} disabled={!report}><FileText className="ml-2 h-4 w-4" />PDF / طباعة</Button></div>}>
    <div dir="rtl" className="space-y-5 pb-10 print:bg-white">
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold text-primary"><BarChart3 className="h-4 w-4" />HADIR · Global Workforce Reporting</div><h1 className="mt-2 text-2xl font-black">لوحة الحضور التنفيذية</h1><p className="mt-1 text-sm text-muted-foreground">بيانات يومية موثقة، مؤشرات تشغيلية، واستثناءات قابلة للتتبع.</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><label className="text-xs font-bold">من<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3 text-sm" /></label><label className="text-xs font-bold">إلى<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3 text-sm" /></label><label className="text-xs font-bold">الموظف<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">كل الموظفين</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.jobNumber}</option>)}</select></label></div><Button onClick={() => void load()} disabled={loading} className="self-start lg:self-end">{loading ? <RefreshCw className="ml-2 h-4 w-4 animate-spin" /> : <CalendarDays className="ml-2 h-4 w-4" />}تحديث التقرير</Button></div></CardContent></Card>

      {error && <Card className="border-destructive/30"><CardContent className="flex items-center gap-3 p-4 text-sm"><TriangleAlert className="h-5 w-5 text-destructive" /><span>{error}</span></CardContent></Card>}
      {loading && !report ? <Card><CardContent className="p-10 text-center text-muted-foreground">جاري بناء التقرير من طبقة البيانات الرسمية…</CardContent></Card> : report && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi title="الموظفون" value={report.summary.employees} detail={`${report.summary.employeeDays} سجل موظف/يوم`} icon={Users} /><Kpi title="نسبة الحضور" value={safePercent(report.summary.attendanceRate)} detail={`الانضباط ${safePercent(report.summary.punctualityRate)}`} icon={BarChart3} /><Kpi title="ساعات العمل" value={fmtMinutes(report.summary.workedMinutes)} detail={`المتوقع ${fmtMinutes(report.summary.expectedMinutes)}`} icon={Clock3} /><Kpi title="الاستثناءات" value={exceptions.length} detail={`تأخر ${report.summary.lateMinutes}د · إضافي ${report.summary.overtimeMinutes}د`} icon={TriangleAlert} /></div>
        <div className="flex flex-wrap gap-2 border-b pb-2"><Button variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>نظرة تنفيذية</Button><Button variant={tab === "daily" ? "default" : "outline"} onClick={() => setTab("daily")}>السجل اليومي</Button><Button variant={tab === "employees" ? "default" : "outline"} onClick={() => setTab("employees")}>الموظفون</Button><Button variant={tab === "exceptions" ? "default" : "outline"} onClick={() => setTab("exceptions")}>الاستثناءات</Button></div>

        {tab === "overview" && <div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle className="text-lg">اتجاه الحضور اليومي</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="attendanceDay" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="present" name="حاضر" fillOpacity={0.18} strokeWidth={2} /><Area type="monotone" dataKey="late" name="متأخر" fillOpacity={0.10} strokeWidth={2} /><Area type="monotone" dataKey="absent" name="غياب" fillOpacity={0.10} strokeWidth={2} /></AreaChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-lg">توزيع الحالات</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>{statusData.map((_, i) => <Cell key={i} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card></div>}
        {tab === "overview" && <Card><CardHeader><CardTitle className="text-lg">الساعات الفعلية مقابل المتوقعة</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="attendanceDay" tick={{ fontSize: 11 }} /><YAxis /><Tooltip formatter={(v) => fmtMinutes(Number(v))} /><Bar dataKey="expectedMinutes" name="المتوقع" fill="currentColor" fillOpacity={0.25} /><Bar dataKey="workedMinutes" name="الفعلي" fill="currentColor" /></BarChart></ResponsiveContainer></CardContent></Card>}

        {tab === "daily" && <Card><CardHeader><CardTitle className="text-lg">السجل اليومي الرسمي</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">التاريخ</th><th className="p-3">الموظف</th><th className="p-3">الحالة</th><th className="p-3">الحضور</th><th className="p-3">الانصراف</th><th className="p-3">العمل</th><th className="p-3">تأخر</th><th className="p-3">مبكر</th><th className="p-3">إضافي</th><th className="p-3">استثناء</th></tr></thead><tbody>{dailyRows.map((r) => <tr key={`${r.attendanceDay}-${r.employeeId}`} className="border-b last:border-0"><td className="p-3">{r.attendanceDay}</td><td className="p-3 font-semibold">{r.employeeName}<div className="text-xs text-muted-foreground">{r.jobNumber || "—"}</div></td><td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold">{statusLabels[r.status] || r.status}</span></td><td className="p-3">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="p-3">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="p-3">{fmtMinutes(r.workedMinutes || 0)}</td><td className="p-3">{r.lateMinutes}د</td><td className="p-3">{r.earlyLeaveMinutes}د</td><td className="p-3">{r.overtimeMinutes}د</td><td className="p-3">{r.exceptionCode || "—"}</td></tr>)}</tbody></table></CardContent></Card>}

        {tab === "employees" && <Card><CardHeader><CardTitle className="text-lg">تحليل الموظفين</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">الموظف</th><th className="p-3">أيام</th><th className="p-3">حاضر</th><th className="p-3">متأخر</th><th className="p-3">غياب</th><th className="p-3">تسجيل ناقص</th><th className="p-3">العمل</th><th className="p-3">التأخر</th><th className="p-3">الإضافي</th></tr></thead><tbody>{topEmployees.map((r) => <tr key={r.employeeId} className="border-b"><td className="p-3 font-semibold">{r.employeeName}<div className="text-xs text-muted-foreground">{r.jobNumber || "—"}</div></td><td className="p-3">{r.days}</td><td className="p-3">{r.present}</td><td className="p-3">{r.late}</td><td className="p-3">{r.absent}</td><td className="p-3">{r.open}</td><td className="p-3">{fmtMinutes(r.workedMinutes)}</td><td className="p-3">{r.lateMinutes}د</td><td className="p-3">{r.overtimeMinutes}د</td></tr>)}</tbody></table></CardContent></Card>}

        {tab === "exceptions" && <Card><CardHeader><CardTitle className="text-lg">مركز الاستثناءات والتتبع</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">التاريخ</th><th className="p-3">الموظف</th><th className="p-3">الكود</th><th className="p-3">الحالة</th><th className="p-3">الدقائق</th><th className="p-3">مصادر</th></tr></thead><tbody>{exceptions.map((x, i) => <tr key={`${x.employeeId}-${x.attendanceDay}-${i}`} className="border-b"><td className="p-3">{x.attendanceDay}</td><td className="p-3 font-semibold">{x.employeeName}</td><td className="p-3">{x.code}</td><td className="p-3">{statusLabels[x.status] || x.status}</td><td className="p-3">{x.minutes}د</td><td className="p-3 text-xs text-muted-foreground">حضور: {x.attendanceEventIds.length} · طلبات: {x.requestIds.length} · تدقيق: {x.auditIds.length}</td></tr>)}</tbody></table>{!exceptions.length && <div className="p-8 text-center text-muted-foreground">لا توجد استثناءات مسجلة في الفترة.</div>}</CardContent></Card>}

        <Card className="bg-muted/30"><CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>المصدر: {report.integrity.sourceOfTruth} ← {report.integrity.rawSource}</span><span>الإصدار {report.reportVersion} · {report.timezone} · {report.dataQuality.complete ? "جودة مكتملة" : "توجد بيانات تحتاج مراجعة"}</span></CardContent></Card>
      </>}
    </div>
  </ManagerLayout>;
}
