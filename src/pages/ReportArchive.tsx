import { useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getEmployees } from "@/lib/storage";
import { getBackendEmployees } from "@/lib/backend";
import { getProfessionalAttendanceReport, type ProfessionalAttendanceReport } from "@/lib/professionalAttendanceReport";
import { downloadProfessionalAttendanceReport } from "@/lib/professionalReportExport";
import { downloadCSV } from "@/lib/csv";
import { archiveReportFile, archivedReportUrl, listArchivedReports } from "@/lib/reportArchive";
import { Archive, Download, FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";
import type { Employee } from "@/types";

const labels: Record<string, string> = { PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غياب", LEAVE: "إجازة", PERMISSION: "استئذان", REST: "راحة", NOT_STARTED: "لم يبدأ", INVALID: "غير صالح" };
const fmt = (m: number) => `${Math.floor(Math.max(0, m) / 60)}س ${Math.round(Math.max(0, m) % 60)}د`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(new Date());

async function snapshotHash(report: ProfessionalAttendanceReport) {
  const payload = JSON.stringify({ reportVersion: report.reportVersion, from: report.from, to: report.to, filters: report.filters, summary: report.summary, rows: report.rows });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ReportArchive() {
  const current = today();
  const [from, setFrom] = useState(`${current.slice(0, 7)}-01`);
  const [to, setTo] = useState(current);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [report, setReport] = useState<ProfessionalAttendanceReport | null>(null);
  const [archives, setArchives] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshArchives = async () => {
    try { setArchives(await listArchivedReports(50) as Array<Record<string, unknown>>); } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الأرشيف"); }
  };

  useEffect(() => {
    let alive = true;
    getBackendEmployees().then((rows) => { if (alive && Array.isArray(rows)) setEmployees(rows); }).catch(() => undefined);
    void refreshArchives();
    return () => { alive = false; };
  }, []);

  const build = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { setError("حدد فترة زمنية صحيحة."); return null; }
    setLoading(true); setError(null); setMessage(null);
    try { const next = await getProfessionalAttendanceReport(from, to, employeeId || undefined); setReport(next); return next; }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر بناء التقرير"); return null; }
    finally { setLoading(false); }
  };

  const saveExcel = async () => {
    const currentReport = report || await build();
    if (!currentReport) return;
    const reportEmployeeId = currentReport.filters.employeeId || undefined;
    const reportType = reportEmployeeId ? "attendance_employee" : currentReport.days === 1 ? "attendance_daily" : "attendance_period";
    setSaving(true); setError(null); setMessage(null);
    try {
      const hash = await snapshotHash(currentReport);
      let archivePromise: Promise<unknown> | null = null;
      downloadProfessionalAttendanceReport({
        mode: currentReport.days === 1 ? "daily" : currentReport.days <= 31 ? "monthly" : "annual",
        period: `${currentReport.from} → ${currentReport.to}`,
        generatedAt: currentReport.generatedAt,
        summaries: currentReport.analytics.employeeSummaries.map((x) => ({ employee: { name: x.employeeName, jobNumber: x.jobNumber }, workDays: x.days, present: x.present, absent: x.absent, early: x.earlyLeaveMinutes, late: x.late, open: x.open, off: x.rest, worked: x.workedMinutes })),
        dailyRows: currentReport.rows.map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: labels[x.status] || x.status, checkIn: x.checkInAt || "—", checkOut: x.checkOutAt || "—", worked: fmt(x.workedMinutes || 0), late: x.lateMinutes, early: x.earlyLeaveMinutes, detail: x.exceptionCode || "" })),
        chartData: [
          { label: "حاضر", value: currentReport.summary.present }, { label: "متأخر", value: currentReport.summary.late }, { label: "غياب", value: currentReport.summary.absent },
          { label: "إجازة", value: currentReport.summary.leave }, { label: "استئذان", value: currentReport.summary.permission }, { label: "راحة", value: currentReport.summary.rest },
        ].filter((x) => x.value > 0),
        absenceRows: currentReport.rows.filter((x) => x.status === "ABSENT").map((x) => ({ employee: x.employeeName, jobNumber: x.jobNumber, date: x.attendanceDay, day: x.attendanceDay, status: "غياب", checkIn: "—", checkOut: "—", worked: "—", late: 0, early: 0, detail: x.exceptionCode || "" })),
        onBlob: (blob) => { archivePromise = archiveReportFile({ file: blob, fileName: `Hadir-${currentReport.from}-${currentReport.to}-professional-attendance.xlsx`, reportType, periodFrom: currentReport.from, periodTo: currentReport.to, employeeId: reportEmployeeId, generatedAt: currentReport.generatedAt, reportVersion: currentReport.reportVersion, dataSnapshotHash: hash }); },
      });
      if (!archivePromise) throw new Error("تعذر إنشاء ملف Excel للأرشفة");
      await archivePromise;
      setMessage("تم حفظ نسخة Excel الرسمية في أرشيف R2 بنجاح.");
      await refreshArchives();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إنشاء الأرشيف"); }
    finally { setSaving(false); }
  };

  const saveCsv = async () => {
    const currentReport = report || await build();
    if (!currentReport) return;
    const reportEmployeeId = currentReport.filters.employeeId || undefined;
    const reportType = reportEmployeeId ? "attendance_employee" : currentReport.days === 1 ? "attendance_daily" : "attendance_period";
    setSaving(true); setError(null); setMessage(null);
    try {
      const hash = await snapshotHash(currentReport);
      const csv = [
        ["التاريخ", "الموظف", "الرقم الوظيفي", "الحالة", "الحضور", "الانصراف", "العمل", "التأخر", "الانصراف المبكر", "الإضافي", "الاستثناء"],
        ...currentReport.rows.map((x) => [x.attendanceDay, x.employeeName, x.jobNumber || "", labels[x.status] || x.status, x.checkInAt || "", x.checkOutAt || "", fmt(x.workedMinutes || 0), x.lateMinutes, x.earlyLeaveMinutes, x.overtimeMinutes, x.exceptionCode || ""]),
      ];
      const escape = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const blob = new Blob(["\uFEFF" + csv.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      downloadCSV(`HADIR-attendance-${currentReport.from}-${currentReport.to}.csv`, csv[0], currentReport.rows.map((x) => [x.attendanceDay, x.employeeName, x.jobNumber || "", labels[x.status] || x.status, x.checkInAt || "", x.checkOutAt || "", fmt(x.workedMinutes || 0), x.lateMinutes, x.earlyLeaveMinutes, x.overtimeMinutes, x.exceptionCode || ""]));
      await archiveReportFile({ file: blob, fileName: `Hadir-${currentReport.from}-${currentReport.to}-professional-attendance.csv`, reportType, periodFrom: currentReport.from, periodTo: currentReport.to, employeeId: reportEmployeeId, generatedAt: currentReport.generatedAt, reportVersion: currentReport.reportVersion, dataSnapshotHash: hash });
      setMessage("تم حفظ نسخة CSV الرسمية في أرشيف R2 بنجاح.");
      await refreshArchives();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ ملف CSV"); }
    finally { setSaving(false); }
  };

  return <ManagerLayout title="أرشيف التقارير" subtitle="أرشيف رسمي · D1 للبيانات الوصفية · R2 للملفات" actions={<Button variant="outline" onClick={() => void refreshArchives()}><RefreshCw className="ml-2 h-4 w-4" />تحديث الأرشيف</Button>}>
    <div dir="rtl" className="space-y-5 pb-10">
      <Card className="border-primary/20 bg-primary/5"><CardContent className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-xs font-bold text-primary">HADIR · REPORT ARCHIVE</div><h1 className="mt-2 text-2xl font-black">أرشيف التقارير الرسمي</h1><p className="mt-1 text-sm text-muted-foreground">حفظ نسخ Excel وCSV مع بصمة SHA-256 وربطها بفترة التقرير ومصدر البيانات.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-xs font-bold">من<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3" /></label><label className="text-xs font-bold">إلى<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-md border bg-background px-3" /></label><label className="text-xs font-bold">الموظف<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block h-10 min-w-52 rounded-md border bg-background px-3"><option value="">كل الموظفين</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.jobNumber}</option>)}</select></label><Button onClick={() => void build()} disabled={loading}>{loading ? <RefreshCw className="ml-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-2 h-4 w-4" />}بناء التقرير</Button></div></div></CardContent></Card>
      {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {message && <Card className="border-primary/30"><CardContent className="p-4 text-sm font-semibold text-primary">{message}</CardContent></Card>}
      {report && <Card><CardHeader><CardTitle>التقرير الجاهز للأرشفة · {report.from} → {report.to}</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">الموظفون</div><b>{report.summary.employees}</b></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">سجلات الأيام</div><b>{report.summary.employeeDays}</b></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">الحضور</div><b>{report.summary.present + report.summary.late}</b></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">جودة البيانات</div><b>{report.dataQuality.complete ? "مكتملة" : "تحتاج مراجعة"}</b></div></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void saveExcel()} disabled={saving}><FileSpreadsheet className="ml-2 h-4 w-4" />حفظ Excel في الأرشيف + تنزيل</Button><Button variant="outline" onClick={() => void saveCsv()} disabled={saving}><Archive className="ml-2 h-4 w-4" />حفظ CSV في الأرشيف + تنزيل</Button></div></CardContent></Card>}
      <Card><CardHeader><CardTitle>النسخ المؤرشفة</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">الفترة</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">الإصدار</th><th className="p-3">الحجم</th><th className="p-3">البصمة</th><th className="p-3">الملف</th></tr></thead><tbody>{archives.map((x, i) => <tr key={String(x.report_id || i)} className="border-b"><td className="p-3">{String(x.period_from || "—")} → {String(x.period_to || "—")}</td><td className="p-3">{String(x.report_type || "—")}</td><td className="p-3">{String(x.status || "—")}</td><td className="p-3">{String(x.report_version || "—")}</td><td className="p-3">{x.file_size ? `${Math.round(Number(x.file_size) / 1024)} KB` : "—"}</td><td className="max-w-[260px] truncate p-3 font-mono text-xs">{String(x.data_snapshot_hash || "—")}</td><td className="p-3"><a className="font-semibold text-primary underline" href={archivedReportUrl(String(x.report_id))} target="_blank" rel="noreferrer"><Download className="mr-1 inline h-4 w-4" />تنزيل</a></td></tr>)}</tbody></table>{!archives.length && <div className="p-8 text-center text-muted-foreground">لا توجد نسخ مؤرشفة حتى الآن.</div>}</CardContent></Card>
      <Card className="bg-muted/30"><CardContent className="p-4 text-xs leading-6 text-muted-foreground">الأرشيف لا يغيّر سجلات الحضور الخام. D1 يحتفظ بالبيانات الوصفية والبصمة، بينما R2 يحتفظ بالملف. زر <b>طباعة الخدمة / PDF</b> في صفحة التقارير يبقى كما هو ولا يتم استبداله بالأرشيف.</CardContent></Card>
    </div>
  </ManagerLayout>;
}
