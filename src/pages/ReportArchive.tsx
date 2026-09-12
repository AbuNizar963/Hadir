import { useCallback, useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, CheckCircle2, Download, FileSpreadsheet, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { deleteArchivedReport, downloadArchivedReport, listArchivedReports } from "@/lib/reportArchive";

type ArchiveRow = {
  report_id: string; report_type: string; period_from: string; period_to: string; generated_at: string;
  generated_by_name: string; report_version: string; data_snapshot_hash: string; status: string;
  file_key: string; file_name: string; file_size: number; mime_type: string; file_sha256: string;
  locked_at: string | null; revision: number;
};
const typeLabel = (value: string) => value === "attendance_period" ? "تقرير حضور شهري" : value === "attendance_daily" ? "تقرير يومي" : value === "attendance_employee" ? "تقرير موظف" : value;
const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString("ar", { timeZone: "Asia/Damascus", dateStyle: "medium", timeStyle: "short" }) : "—";
const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

export default function ReportArchive() {
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const rows = await listArchivedReports(100); setArchives(Array.isArray(rows) ? rows as ArchiveRow[] : []); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل أرشيف التقارير"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const handleDownload = async (archive: ArchiveRow) => {
    setBusyId(archive.report_id); setError(null);
    try { await downloadArchivedReport(archive.report_id, archive.file_name); setDownloaded((current) => ({ ...current, [archive.report_id]: true })); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تنزيل ملف Excel"); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (archive: ArchiveRow) => {
    if (!downloaded[archive.report_id]) return;
    const confirmed = window.confirm(`سيتم حذف ملف الأرشيف «${archive.file_name}» نهائيًا من أرشيف التقارير. بيانات الحضور الأصلية لن تُحذف. هل تريد المتابعة؟`);
    if (!confirmed) return;
    setBusyId(archive.report_id); setError(null);
    try { await deleteArchivedReport(archive.report_id); setArchives((current) => current.filter((item) => item.report_id !== archive.report_id)); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف الأرشيف"); }
    finally { setBusyId(null); }
  };

  return <ManagerLayout title="أرشيف التقارير" subtitle="النسخ الشهرية المقفلة · الملفات محفوظة في R2" actions={<Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تحديث الأرشيف</Button>}>
    <div dir="rtl" className="space-y-5 pb-10">
      <Card className="border-primary/20 bg-primary/5"><CardContent className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-xs font-bold text-primary">HADIR · REPORT ARCHIVE</div><h1 className="mt-2 text-2xl font-black">أرشيف التقارير الرسمي</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">هنا تظهر التقارير الشهرية التي تم إقفالها تلقائيًا وحفظ ملف Excel النهائي لها في R2. الحذف متاح فقط بعد نجاح تنزيل الملف.</p></div><div className="flex shrink-0 items-center gap-2 rounded-xl border bg-background/70 px-4 py-3 text-sm font-semibold"><ShieldCheck className="h-5 w-5 text-primary" /><span>{archives.length} نسخة مؤرشفة</span></div></div></CardContent></Card>
      {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />الملفات المؤرشفة</CardTitle></CardHeader><CardContent className="overflow-x-auto">{loading && !archives.length ? <div className="p-10 text-center text-muted-foreground">جاري تحميل الأرشيف…</div> : <table className="w-full min-w-[1180px] text-sm"><thead><tr className="border-b text-right"><th className="p-3">الفترة</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">الإصدار</th><th className="p-3">تاريخ الإقفال</th><th className="p-3">الحجم</th><th className="p-3">البصمة</th><th className="p-3">الإجراءات</th></tr></thead><tbody>{archives.map((archive) => { const isBusy = busyId === archive.report_id; const canDelete = downloaded[archive.report_id] === true; return <tr key={archive.report_id} className="border-b hover:bg-muted/40"><td className="p-3 font-semibold">{archive.period_from} → {archive.period_to}</td><td className="p-3">{typeLabel(archive.report_type)}</td><td className="p-3"><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><ShieldCheck className="h-3.5 w-3.5" />مقفل</span></td><td className="p-3">{archive.report_version || "—"} · نسخة {archive.revision || 1}</td><td className="p-3">{formatDateTime(archive.locked_at)}</td><td className="p-3">{formatSize(Number(archive.file_size || 0))}</td><td className="max-w-[230px] truncate p-3 font-mono text-xs" title={archive.file_sha256}>{archive.file_sha256 || "—"}</td><td className="p-3"><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => void handleDownload(archive)} disabled={isBusy}>{isBusy ? <RefreshCw className="ml-1 h-4 w-4 animate-spin" /> : downloaded[archive.report_id] ? <CheckCircle2 className="ml-1 h-4 w-4" /> : <Download className="ml-1 h-4 w-4" />}تنزيل Excel</Button><Button size="sm" variant="destructive" onClick={() => void handleDelete(archive)} disabled={!canDelete || isBusy} title={canDelete ? "حذف الأرشيف بعد تنزيله" : "يجب تنزيل الملف أولًا قبل الحذف"}><Trash2 className="ml-1 h-4 w-4" />حذف</Button></div>{!canDelete && <div className="mt-1 text-[11px] text-muted-foreground">التنزيل أولًا مطلوب للحذف</div>}</td></tr>; })}</tbody></table>}{!loading && !archives.length && <div className="p-10 text-center text-muted-foreground"><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-50" /><p className="font-semibold">لا توجد تقارير مقفلة في الأرشيف حتى الآن.</p><p className="mt-1 text-xs">سيظهر التقرير الشهري هنا بعد أن ينفذ نظام الأرشفة التلقائي عملية الإقفال والتحقق من ملف R2.</p></div>}</CardContent></Card>
    </div>
  </ManagerLayout>;
}
