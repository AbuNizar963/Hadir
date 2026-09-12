import { useCallback, useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Download, FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";
import { archivedReportUrl, listArchivedReports } from "@/lib/reportArchive";

type ArchiveRow = {
  report_id: string;
  report_type: string;
  period_from: string;
  period_to: string;
  generated_at: string;
  generated_by_name: string;
  report_version: string;
  data_snapshot_hash: string;
  status: string;
  file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_sha256: string;
  locked_at: string | null;
  revision: number;
};

const typeLabel = (value: string) => value === "attendance_period" ? "تقرير حضور شهري" : value === "attendance_daily" ? "تقرير يومي" : value === "attendance_employee" ? "تقرير موظف" : value;
const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString("ar", { timeZone: "Asia/Damascus", dateStyle: "medium", timeStyle: "short" }) : "—";
const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

export default function ReportArchive() {
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listArchivedReports(100);
      setArchives(Array.isArray(rows) ? rows as ArchiveRow[] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل أرشيف التقارير");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <ManagerLayout title="أرشيف التقارير" subtitle="النسخ الشهرية المقفلة · الملفات محفوظة في R2" actions={<Button variant="outline" onClick={() => void refresh()} disabled={loading}>{loading ? <RefreshCw className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}تحديث الأرشيف</Button>}>
    <div dir="rtl" className="space-y-5 pb-10">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold text-primary">HADIR · REPORT ARCHIVE</div>
              <h1 className="mt-2 text-2xl font-black">أرشيف التقارير الرسمي</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">هنا تظهر التقارير الشهرية التي تم إقفالها تلقائيًا وحفظ ملف Excel النهائي لها في R2. فتح الأرشيف لا ينشئ أو يعدّل أي بيانات.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border bg-background/70 px-4 py-3 text-sm font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>{archives.length} نسخة مؤرشفة</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />الملفات المؤرشفة</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && !archives.length ? <div className="p-10 text-center text-muted-foreground">جاري تحميل الأرشيف…</div> : <table className="w-full min-w-[1050px] text-sm">
            <thead><tr className="border-b text-right"><th className="p-3">الفترة</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">الإصدار</th><th className="p-3">تاريخ الإقفال</th><th className="p-3">الحجم</th><th className="p-3">البصمة</th><th className="p-3">الملف</th></tr></thead>
            <tbody>{archives.map((archive) => <tr key={archive.report_id} className="border-b hover:bg-muted/40">
              <td className="p-3 font-semibold">{archive.period_from} → {archive.period_to}</td>
              <td className="p-3">{typeLabel(archive.report_type)}</td>
              <td className="p-3"><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><ShieldCheck className="h-3.5 w-3.5" />مقفل</span></td>
              <td className="p-3">{archive.report_version || "—"} · نسخة {archive.revision || 1}</td>
              <td className="p-3">{formatDateTime(archive.locked_at)}</td>
              <td className="p-3">{formatSize(Number(archive.file_size || 0))}</td>
              <td className="max-w-[230px] truncate p-3 font-mono text-xs" title={archive.file_sha256}>{archive.file_sha256 || "—"}</td>
              <td className="p-3"><a className="inline-flex items-center font-bold text-primary underline" href={archivedReportUrl(archive.report_id)} download={archive.file_name} target="_blank" rel="noreferrer"><Download className="ml-1 h-4 w-4" />تنزيل Excel</a></td>
            </tr>)}</tbody>
          </table>}
          {!loading && !archives.length && <div className="p-10 text-center text-muted-foreground"><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-50" /><p className="font-semibold">لا توجد تقارير مقفلة في الأرشيف حتى الآن.</p><p className="mt-1 text-xs">سيظهر التقرير الشهري هنا بعد أن ينفذ نظام الأرشفة التلقائي عملية الإقفال والتحقق من ملف R2.</p></div>}
        </CardContent>
      </Card>
    </div>
  </ManagerLayout>;
}
