import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmployees } from "@/lib/storage";
import { getBackendEmployees } from "@/lib/backend";
import { getProfessionalAttendanceReport, getProfessionalAttendanceDrilldown, type ProfessionalAttendanceDrilldown, type ProfessionalAttendanceReport } from "@/lib/professionalAttendanceReport";
import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";
import { downloadCSV } from "@/lib/csv";
import { BarChart3, CalendarDays, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import type { Employee } from "@/types";

const labels: Record<string, string> = { PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غياب", LEAVE: "إجازة", PERMISSION: "استئذان", REST: "راحة", NOT_STARTED: "لم يبدأ", INVALID: "غير صالح" };
const fmt = (m: number) => `${Math.floor(Math.max(0, m) / 60)}س ${Math.round(Math.max(0, m) % 60)}د`;
const damascusToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(new Date());
const time = (value: unknown) => value ? new Date(String(value)).toLocaleString("ar", { timeZone: "Asia/Damascus", dateStyle: "medium", timeStyle: "medium" }) : "—";

function Kpi({ title, value, detail, icon: Icon }: { title: string; value: string | number; detail: string; icon: typeof Users }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-sm text-muted-foreground">{title}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

export default function GlobalAttendanceReports() {
  const today = damascusToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [report, setReport] = useState<ProfessionalAttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "daily" | "employees" | "exceptions">("overview");
  const [detail, setDetail] = useState<ProfessionalAttendanceDrilldown | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { setError("حدد فترة زمنية صحيحة."); return; }
    setLoading(true); setError(null);
    try { setReport(await getProfessionalAttendanceReport(from, to, employeeId || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل التقرير"); }
    finally { setLoading(false); }
  };

  const openDetail = async (attendanceDay: string, id: string) => {
    setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getProfessionalAttendanceDrilldown(attendanceDay, id)); }
    catch (e) { setDetailError(e instanceof Error ? e.message : "تعذر تحميل التفصيل"); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => { let alive = true; getBackendEmployees().then((rows) => { if (alive && Array.isArray(rows)) setEmployees(rows); }).catch(() => undefined); return () => { alive = false; }; }, []);
  useEffect(() => { void load(); }, []);

  const daily = report?.analytics.dailySeries || [];
  const rows = report?.rows || [];
  const employeeSummary = report?.analytics.employeeSummaries || [];
  const exceptions = report?.analytics.exceptions || [];
  const statusData = report ? [
    { name: "حاضر", value: report.summary.present }, { name: "متأخر", value: report.summary.late }, { name: "غياب", value: report.summary.absent },
    { name: "إجازة", value: report.summary.leave }, { name: "استئذان", value: report.summary.permission }, { name: "راحة", value: report.summary.rest },
  ].filter((x) => x.value > 0) : [];
  const rankedEmployees = useMemo(() => [...employeeSummary].sort((a, b) => (b.absent * 1000 + b.lateMinutes + b.overtimeMinutes) - (a.absent * 1000 + a.lateMinutes + a.overtimeMinutes)), [employeeSummary]);

  const exportExcel = () => {
    if (!report) return;
    downloadProfessionalAttendanceReport({
      mode: report.days === 1 ? "daily" : report.days <= 31 ? "monthly" : "annual",
      period: `${report.from} → ${report.to}`,
      generatedAt: report.generatedAt,
      summaries: employeeSummary.map((x) => ({ employee: { name: x.employeeName, jobNumber: x.jobNumber }, workDays: x.days, present: x.present, absent: x.absent, early: 0, late: x.late, open: x.open, off: x.rest, worked: x.workedMinutes })),
      dailyRows: rows.map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: labels[x.status] || x.status, checkIn: x.checkInAt || "—", checkOut: x.checkOutAt || "—", worked: fmt(x.workedMinutes || 0), late: x.lateMinutes, early: x.earlyLeaveMinutes, detail: x.exceptionCode || "" })),
      chartData: statusData,
      absenceRows: rows.filter((x) => x.status === "ABSENT").map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: "غياب", checkIn: "—", checkOut: "—", worked: "—", late: 0, early: 0, detail: x.exceptionCode || "" })),
    });
  };
  const exportCsv = () => {
    if (!report) return;
    downloadCSV(`HADIR-attendance-${report.from}-${report.to}.csv`, ["التاريخ", "الموظف", "الرقم الوظيفي", "الحالة", "الحضور", "الانصراف", "العمل", "التأخر", "الانصراف المبكر", "الإضافي", "الاستثناء"], rows.map((x) => [x.attendanceDay, x.employeeName, x.jobNumber || "", labels[x.status] || x.status, x.checkInAt || "", x.checkOutAt || "", fmt(x.workedMinutes || 0), x.lateMinutes, x.earlyLeaveMinutes, x.overtimeMinutes, x.exceptionCode || ""]));
  };

  return <ManagerLayout title="التقارير" subtitle="نظام التقارير العالمي · الحضور والموارد البشرية" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!report} onClick={exportExcel}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button variant="outline" disabled={!report} onClick={exportCsv}><Download className="ml-2 h-4 w-4" />CSV</Button><Button disabled={!report} onClick={() => window.print()}><FileText className="ml-2 h-4 w-4" />{report?.days === 1 ? "طباعة الخدمة / PDF" : "PDF / طباعة"}</Button></div>}>
    <div dir="rtl" className="space-y-5 pb-10">
      <Card className="border-primary/20 bg-primary/5"><CardContent className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-xs font-bold text-primary">HADIR · GLOBAL WORKFORCE REPORTING</div><h1 className="mt-2 text-2xl font-black">لوحة الحضور التنفيذية</h1><p className="mt-1 text-sm text-muted-foreground">مصدر موحد للسجل اليومي، المؤشرات، الساعات، والاستثناءات.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-xs font-bold">من<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3" /></label><label className="text-xs font-bold">إلى<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3" /></label><label className="text-xs font-bold">الموظف<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block h-10 min-w-52 rounded-md border bg-background px-3"><option value="">كل الموظفين</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.jobNumber}</option>)}</select></label><Button onClick={() => void load()} disabled={loading}>{loading ? <RefreshCw className="ml-2 h-4 w-4 animate-spin" /> : <CalendarDays className="ml-2 h-4 w-4" />}تحديث</Button></div></div></CardContent></Card>
      {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {loading && !report && <Card><CardContent className="p-10 text-center text-muted-foreground">جاري بناء التقرير من طبقة البيانات الرسمية…</CardContent></Card>}
      {report && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi title="الموظفون" value={report.summary.employees} detail={`${report.summary.employeeDays} سجل موظف/يوم`} icon={Users} /><Kpi title="الحضور" value={`${report.summary.present + report.summary.late}`} detail={`معدل الحضور ${report.summary.attendanceRate.toFixed(1)}%`} icon={BarChart3} /><Kpi title="الساعات" value={fmt(report.summary.workedMinutes)} detail={`المتوقع ${fmt(report.summary.expectedMinutes)}`} icon={Clock3} /><Kpi title="الاستثناءات" value={exceptions.length} detail={`تأخر ${report.summary.lateMinutes}د · إضافي ${report.summary.overtimeMinutes}د`} icon={TriangleAlert} /></div>
        <div className="flex flex-wrap gap-2"><Button variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>النظرة التنفيذية</Button><Button variant={tab === "daily" ? "default" : "outline"} onClick={() => setTab("daily")}>السجل اليومي</Button><Button variant={tab === "employees" ? "default" : "outline"} onClick={() => setTab("employees")}>الموظفون</Button><Button variant={tab === "exceptions" ? "default" : "outline"} onClick={() => setTab("exceptions")}>الاستثناءات</Button></div>
        {tab === "overview" && <><div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle className="text-lg">اتجاه الحضور والغياب</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="attendanceDay" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="present" name="حاضر" fillOpacity={0.15} strokeWidth={2} /><Area type="monotone" dataKey="late" name="متأخر" fillOpacity={0.12} strokeWidth={2} /><Area type="monotone" dataKey="absent" name="غياب" fillOpacity={0.12} strokeWidth={2} /></AreaChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-lg">توزيع الحالات</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>{statusData.map((_, i) => <Cell key={i} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card></div><Card><CardHeader><CardTitle className="text-lg">الساعات الفعلية مقابل المتوقعة</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="attendanceDay" tick={{ fontSize: 11 }} /><YAxis /><Tooltip formatter={(v) => fmt(Number(v))} /><Bar dataKey="expectedMinutes" name="المتوقع" fill="currentColor" fillOpacity={0.25} /><Bar dataKey="workedMinutes" name="الفعلي" fill="currentColor" /></BarChart></ResponsiveContainer></CardContent></Card></>}
        {tab === "daily" && <Card><CardHeader><CardTitle className="text-lg">السجل اليومي الرسمي · {report.from} → {report.to}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b text-right">{["التاريخ","الموظف","الحالة","الحضور","الانصراف","العمل","التأخر","المبكر","الإضافي","الاستثناء"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={`${r.attendanceDay}-${r.employeeId}`} className="cursor-pointer border-b hover:bg-muted/50" onClick={() => void openDetail(r.attendanceDay, r.employeeId)}><td className="p-3">{r.attendanceDay}</td><td className="p-3 font-semibold">{r.employeeName}<div className="text-xs text-muted-foreground">{r.jobNumber || "—"}</div></td><td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold">{labels[r.status] || r.status}</span></td><td className="p-3">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Damascus" }) : "—"}</td><td className="p-3">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Damascus" }) : "—"}</td><td className="p-3">{fmt(r.workedMinutes || 0)}</td><td className="p-3">{r.lateMinutes}د</td><td className="p-3">{r.earlyLeaveMinutes}د</td><td className="p-3">{r.overtimeMinutes}د</td><td className="p-3">{r.exceptionCode || "—"}</td></tr>)}</tbody></table></CardContent></Card>}
        {tab === "employees" && <Card><CardHeader><CardTitle className="text-lg">تحليل الموظفين</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-right">{["الموظف","الأيام","حاضر","متأخر","غياب","ناقص","العمل","التأخر","الإضافي"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rankedEmployees.map((r) => <tr key={r.employeeId} className="cursor-pointer border-b hover:bg-muted/50" onClick={() => { setEmployeeId(r.employeeId); setTab("daily"); }}><td className="p-3 font-semibold">{r.employeeName}<div className="text-xs text-muted-foreground">{r.jobNumber || "—"}</div></td><td className="p-3">{r.days}</td><td className="p-3">{r.present}</td><td className="p-3">{r.late}</td><td className="p-3">{r.absent}</td><td className="p-3">{r.open}</td><td className="p-3">{fmt(r.workedMinutes)}</td><td className="p-3">{r.lateMinutes}د</td><td className="p-3">{r.overtimeMinutes}د</td></tr>)}</tbody></table></CardContent></Card>}
        {tab === "exceptions" && <Card><CardHeader><CardTitle className="text-lg">مركز الاستثناءات والتتبع</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">التاريخ</th><th className="p-3">الموظف</th><th className="p-3">الكود</th><th className="p-3">الحالة</th><th className="p-3">الدقائق</th><th className="p-3">الحضور</th><th className="p-3">الطلبات</th><th className="p-3">التدقيق</th></tr></thead><tbody>{exceptions.map((x, i) => <tr key={`${x.employeeId}-${x.attendanceDay}-${i}`} className="cursor-pointer border-b hover:bg-muted/50" onClick={() => void openDetail(x.attendanceDay, x.employeeId)}><td className="p-3">{x.attendanceDay}</td><td className="p-3 font-semibold">{x.employeeName}</td><td className="p-3">{x.code}</td><td className="p-3">{labels[x.status] || x.status}</td><td className="p-3">{x.minutes}د</td><td className="p-3">{x.attendanceEventIds.length}</td><td className="p-3">{x.requestIds.length}</td><td className="p-3">{x.auditIds.length}</td></tr>)}</tbody></table>{!exceptions.length && <div className="p-8 text-center text-muted-foreground">لا توجد استثناءات في الفترة المحددة.</div>}</CardContent></Card>}
        <Card className="bg-muted/30"><CardContent className="flex flex-wrap justify-between gap-2 p-4 text-xs text-muted-foreground"><span>المصدر: {report.integrity.sourceOfTruth} ← {report.integrity.rawSource}</span><span>الإصدار {report.reportVersion} · {report.timezone} · {report.dataQuality.complete ? "جودة مكتملة" : "توجد بيانات تحتاج مراجعة"}</span></CardContent></Card>
      </>}
    </div>

    <Dialog open={detail !== null || detailLoading || detailError !== null} onOpenChange={(open) => { if (!open && !detailLoading) { setDetail(null); setDetailError(null); } }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>تفصيل سجل الحضور</DialogTitle><DialogDescription>تفصيل قراءة فقط مرتبط بسجل التقرير ومصادره الأصلية.</DialogDescription></DialogHeader>
        {detailLoading && <div className="p-8 text-center text-muted-foreground">جاري تحميل السجل والمصادر المرتبطة…</div>}
        {detailError && <div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">{detailError}</div>}
        {detail && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">الموظف</div><div className="mt-1 font-bold">{detail.fact.employeeName}</div><div className="text-xs text-muted-foreground">{detail.fact.jobNumber || "—"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">اليوم / الحالة</div><div className="mt-1 font-bold">{detail.fact.attendanceDay}</div><div className="text-xs">{labels[detail.fact.status] || detail.fact.status}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">الحضور / الانصراف</div><div className="mt-1 text-sm">{time(detail.fact.checkInAt)}</div><div className="text-sm">{time(detail.fact.checkOutAt)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">الساعات</div><div className="mt-1 font-bold">{fmt(Number(detail.fact.workedMinutes || 0))}</div><div className="text-xs text-muted-foreground">متوقع {fmt(Number(detail.fact.expectedMinutes || 0))}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle className="text-base">الجدول والحساب</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm sm:grid-cols-2"><div>بداية الدوام: <b>{detail.fact.scheduledStart || "—"}</b></div><div>نهاية الدوام: <b>{detail.fact.scheduledEnd || "—"}</b></div><div>التأخر: <b>{detail.fact.lateMinutes}د</b></div><div>الانصراف المبكر: <b>{detail.fact.earlyLeaveMinutes}د</b></div><div>الإضافي: <b>{detail.fact.overtimeMinutes}د</b></div><div>الاستثناء: <b>{detail.fact.exceptionCode || "—"}</b></div><div>مصدر الحساب: <b>{detail.fact.calculationSource}</b></div><div>إصدار الحساب: <b>{detail.fact.calculationVersion}</b></div><div>جودة التاريخ: <b>{detail.fact.historicalDataQuality}</b></div><div>سبب الجودة: <b>{detail.fact.dataQualityReason || "—"}</b></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">سجل الحضور الخام المرتبط ({detail.sources.attendance.length})</CardTitle></CardHeader><CardContent className="space-y-2">{detail.sources.attendance.map((x) => <div key={String(x.id)} className="rounded-md border p-3 text-xs"><div className="font-bold">ID: {String(x.id)}</div><div className="mt-1 grid gap-1 sm:grid-cols-2"><div>النوع: {String(x.type || "—")}</div><div>الوقت: {time(x.timestamp)}</div><div>الموقع: {String(x.location_id || "—")}</div><div>الجهاز: {String(x.device_id || "—")}</div><div>المسافة: {String(x.distance_meters ?? "—")}</div><div>الإحداثيات: {String(x.lat ?? "—")}, {String(x.lng ?? "—")}</div></div></div>)}{!detail.sources.attendance.length && <div className="text-sm text-muted-foreground">لا توجد سجلات حضور مرتبطة بهذا الاستنتاج.</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">الطلبات المرتبطة ({detail.sources.requests.length})</CardTitle></CardHeader><CardContent className="space-y-2">{detail.sources.requests.map((x) => <div key={String(x.id)} className="rounded-md border p-3 text-xs"><div className="font-bold">ID: {String(x.id)}</div><div className="mt-1 grid gap-1 sm:grid-cols-2"><div>النوع: {String(x.type || "—")}</div><div>الحالة: {String(x.status || "—")}</div><div>من: {String(x.start_date || "—")}</div><div>إلى: {String(x.end_date || "—")}</div><div className="sm:col-span-2">السبب: {String(x.reason || "—")}</div></div></div>)}{!detail.sources.requests.length && <div className="text-sm text-muted-foreground">لا توجد طلبات مرتبطة.</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">سجل التدقيق المرتبط ({detail.sources.audit.length})</CardTitle></CardHeader><CardContent className="space-y-2">{detail.sources.audit.map((x) => <div key={String(x.id)} className="rounded-md border p-3 text-xs"><div className="font-bold">ID: {String(x.id)}</div><div className="mt-1 grid gap-1 sm:grid-cols-2"><div>الإجراء: {String(x.action || "—")}</div><div>النتيجة: {String(x.result || "—")}</div><div>الوقت: {time(x.timestamp)}</div><div>الفاعل: {String(x.actor_name || "—")}</div><div className="sm:col-span-2">السبب: {String(x.reason || "—")}</div></div></div>)}{!detail.sources.audit.length && <div className="text-sm text-muted-foreground">لا توجد سجلات تدقيق مرتبطة.</div>}</CardContent></Card>
          <Card className="bg-muted/30"><CardContent className="space-y-2 p-4 text-xs text-muted-foreground"><div>لقطة الجدول: <code className="break-all">{JSON.stringify(detail.fact.scheduleSnapshot)}</code></div><div>معرّفات المصدر: حضور {detail.trace.attendanceEventIds.length} · طلبات {detail.trace.requestIds.length} · تدقيق {detail.trace.auditIds.length}</div><div>وضع القراءة: {detail.trace.readOnly ? "قراءة فقط" : "غير معروف"} · لا تعديل على الحضور الخام: {detail.trace.noRawAttendanceMutation ? "نعم" : "غير معروف"}</div></CardContent></Card>
        </div>}
      </DialogContent>
    </Dialog>
  </ManagerLayout>;
}
