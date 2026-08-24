import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAttendance, getEmployees, getSettings } from "@/lib/storage";
import { getBackendAudit, getBackendEmployees, saveBackendSettings } from "@/lib/backend";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import { formatDate, formatDurationMinutes, formatTime, minutesBetween } from "@/lib/utils";
import { FileSpreadsheet, FileText, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import { XLSX, autoFitColumns, styleExcelTable, styleReportWorkbook, setExcelRtl, type ExcelCell } from "@/lib/excelExport";
import type { AttendanceRecord, Employee } from "@/types";

type Mode = "daily" | "monthly" | "annual";
type ReportRow = {
  key: string;
  name: string;
  jobNumber: string;
  checkIn: string;
  checkOut: string;
  late: number;
  worked: number;
  status: string;
  detail: string;
};
type StoredReport = {
  mode: Mode;
  period: string;
  generatedAt: string;
  employeeCount: number;
  rows: ReportRow[];
};

function toDay(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function auditAttendance(items: any[]): AttendanceRecord[] {
  return items
    .filter((a) => a?.result === "success" && a?.employeeId && (a?.action === "check-in" || a?.action === "check-out"))
    .map((a) => ({
      id: String(a.id),
      employeeId: String(a.employeeId),
      jobNumber: String(a.jobNumber || ""),
      employeeName: String(a.actorName || a.employeeName || ""),
      type: a.action,
      timestamp: String(a.timestamp),
      lat: Number(a.lat || 0),
      lng: Number(a.lng || 0),
      distanceMeters: Number(a.distanceMeters || 0),
      deviceId: String(a.deviceId || ""),
      ip: String(a.ip || ""),
      qrCode: "",
    }));
}

function findSession(records: AttendanceRecord[], employeeId: string, start: Date | null, end: Date | null) {
  if (!start) return { inRecord: undefined as AttendanceRecord | undefined, outRecord: undefined as AttendanceRecord | undefined };
  const list = records
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  let inRecord: AttendanceRecord | undefined;
  let outRecord: AttendanceRecord | undefined;
  for (const record of list) {
    const time = +new Date(record.timestamp);
    if (record.type === "check-in" && time >= +start && (!end || time <= +end + 60000)) {
      inRecord = record;
      outRecord = undefined;
    } else if (record.type === "check-out" && inRecord && time >= +new Date(inRecord.timestamp) && (!end || time <= +end + 60000)) {
      outRecord = record;
      break;
    }
  }
  return { inRecord, outRecord };
}

export default function ManagerReports() {
  const [mode, setMode] = useState<Mode>("daily");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(getAttendance());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const settings = getSettings();

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const errors: string[] = [];
      try {
        const list = await getBackendEmployees();
        if (!stopped && Array.isArray(list)) setEmployees(list);
      } catch (e) {
        errors.push(`الموظفون: ${e instanceof Error ? e.message : "فشل الجلب"}`);
      }
      try {
        const audit = await getBackendAudit(5000);
        if (!stopped && Array.isArray(audit)) setAttendance(auditAttendance(audit));
      } catch (e) {
        errors.push(`الحضور: ${e instanceof Error ? e.message : "فشل الجلب"}`);
      }
      if (!stopped) {
        setLoading(false);
        if (errors.length) setError(errors.join(" · "));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo<ReportRow[]>(() => {
    if (mode === "daily") {
      const target = toDay(date);
      return employees.map((employee) => {
        const work = getEmployeeWorkPeriod(employee, target);
        if (!work.isWorkDay) {
          return { key: employee.id, name: employee.name, jobNumber: employee.jobNumber, checkIn: "—", checkOut: "—", late: 0, worked: 0, status: "راحة", detail: work.detail || "لا يوجد دوام مجدول" };
        }
        const session = findSession(attendance, employee.id, work.start, work.end);
        const grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
        const late = session.inRecord && work.start
          ? Math.max(0, Math.round((+new Date(session.inRecord.timestamp) - +work.start) / 60000) - grace)
          : 0;
        return {
          key: employee.id,
          name: employee.name,
          jobNumber: employee.jobNumber,
          checkIn: session.inRecord ? formatTime(session.inRecord.timestamp) : "—",
          checkOut: session.outRecord ? formatTime(session.outRecord.timestamp) : "—",
          late,
          worked: session.inRecord ? minutesBetween(session.inRecord.timestamp, session.outRecord?.timestamp ?? new Date().toISOString()) : 0,
          status: !session.inRecord ? "غياب" : !session.outRecord ? "حاضر · بدون انصراف" : "مكتمل",
          detail: work.detail || "يوم عمل",
        };
      });
    }

    const [y, m] = mode === "monthly" ? month.split("-").map(Number) : [Number(year), 1];
    const months = mode === "monthly" ? [m - 1] : Array.from({ length: 12 }, (_, i) => i);
    return employees.map((employee) => {
      let workDays = 0;
      let restDays = 0;
      let absent = 0;
      let complete = 0;
      let open = 0;
      let late = 0;
      let worked = 0;
      for (const mo of months) {
        const days = new Date(y, mo + 1, 0).getDate();
        for (let d = 1; d <= days; d += 1) {
          const work = getEmployeeWorkPeriod(employee, new Date(y, mo, d, 12));
          if (!work.isWorkDay) {
            restDays += 1;
            continue;
          }
          workDays += 1;
          const session = findSession(attendance, employee.id, work.start, work.end);
          if (!session.inRecord) absent += 1;
          else if (!session.outRecord) open += 1;
          else {
            complete += 1;
            worked += minutesBetween(session.inRecord.timestamp, session.outRecord.timestamp);
          }
          if (session.inRecord && work.start) {
            late += Math.max(0, Math.round((+new Date(session.inRecord.timestamp) - +work.start) / 60000) - (employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10));
          }
        }
      }
      return {
        key: employee.id,
        name: employee.name,
        jobNumber: employee.jobNumber,
        checkIn: "",
        checkOut: "",
        late,
        worked,
        status: complete ? "مكتمل" : absent ? "غياب" : "—",
        detail: `عمل: ${workDays} · راحة: ${restDays} · غياب: ${absent} · مكتمل: ${complete} · بدون انصراف: ${open}`,
      };
    });
  }, [mode, date, month, year, employees, attendance, settings]);

  const period = mode === "daily" ? date : mode === "monthly" ? month : year;
  const reportKey = `report.${mode}.${period}`;

  useEffect(() => {
    if (loading || !employees.length) return;
    let cancelled = false;
    const persist = async () => {
      try {
        const report: StoredReport = { mode, period, generatedAt: new Date().toISOString(), employeeCount: employees.length, rows };
        await saveBackendSettings({ [reportKey]: report } as any);
        if (!cancelled) setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        if (!cancelled) setError(`تعذر حفظ التقرير في D1: ${e instanceof Error ? e.message : "فشل الحفظ"}`);
      }
    };
    void persist();
    return () => { cancelled = true; };
  }, [loading, employees, rows, mode, period, reportKey]);

  const exportCsv = () => {
    const headers: string[] = mode === "daily"
      ? ["م", "الموظف", "الرقم الوظيفي", "الحضور", "الانصراف", "التأخر", "ساعات العمل", "الحالة", "الجدول"]
      : ["م", "الموظف", "الرقم الوظيفي", "الملخص", "إجمالي التأخر", "إجمالي ساعات العمل"];
    const data: CsvCell[][] = rows.map((row, i) => mode === "daily"
      ? [i + 1, row.name, row.jobNumber, row.checkIn, row.checkOut, row.late, formatDurationMinutes(row.worked), row.status, row.detail]
      : [i + 1, row.name, row.jobNumber, row.detail, row.late, formatDurationMinutes(row.worked)]);
    downloadCSV(`Hadir-${mode}-report-${period}`, headers, data);
  };

  const exportExcel = () => {
    const headers: ExcelCell[] = mode === "daily"
      ? ["م", "الموظف", "الرقم الوظيفي", "الحضور", "الانصراف", "التأخر", "ساعات العمل", "الحالة", "الجدول"]
      : ["م", "الموظف", "الرقم الوظيفي", "الملخص", "إجمالي التأخر", "إجمالي ساعات العمل"];
    const data: ExcelCell[][] = rows.map((row, i) => mode === "daily"
      ? [i + 1, row.name, row.jobNumber, row.checkIn, row.checkOut, row.late, formatDurationMinutes(row.worked), row.status, row.detail]
      : [i + 1, row.name, row.jobNumber, row.detail, row.late, formatDurationMinutes(row.worked)]);
    const ws = XLSX.utils.aoa_to_sheet([[`تقرير الحضور - ${period}`], [], headers, ...data]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    autoFitColumns(ws, [headers, ...data], 10, 45);
    styleExcelTable(ws, 2, data.length + 2, 0, headers.length - 1, 3, 0);
    styleReportWorkbook(ws, mode === "daily" ? 7 : undefined, 3, data.length + 2);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");
    setExcelRtl(wb, ws);
    const url = URL.createObjectURL(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hadir-${mode}-report-${period}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <ManagerLayout
      title="التقارير"
      subtitle={mode === "daily" ? `يومي · ${formatDate(date)}` : mode === "monthly" ? `شهري · ${month}` : `سنوي · ${year}`}
      actions={
        <div className="flex gap-2">
          <Button onClick={exportExcel} disabled={!rows.length}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button>
          <Button onClick={exportCsv} variant="outline" disabled={!rows.length}><FileText className="ml-2 h-4 w-4" />CSV</Button>
        </div>
      }
    >
      <div className="hud-card p-4 mb-5 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {(["daily", "monthly", "annual"] as Mode[]).map((value) => (
            <button key={value} onClick={() => setMode(value)} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {value === "daily" ? "يومي" : value === "monthly" ? "شهري" : "سنوي"}
            </button>
          ))}
          {mode === "daily" && <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}
          {mode === "monthly" && <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />}
          {mode === "annual" && <input type="number" className="input w-32" value={year} onChange={(e) => setYear(e.target.value)} />}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-4 w-4 text-primary" />
          <span>مصدر التقرير: D1 — الموظفون والحضور الدائم.</span>
          {loading && <><Loader2 className="h-3 w-3 animate-spin" />جاري القراءة من D1...</>}
          {savedAt && <span className="text-emerald-600 font-bold">محفوظ في D1 · {savedAt}</span>}
        </div>
        {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
      </div>

      <div className="hud-card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              <th className="p-3 text-right">م</th><th className="p-3 text-right">الموظف</th><th className="p-3 text-right">الرقم</th>
              {mode === "daily" ? <>
                <th className="p-3 text-right">الحضور</th><th className="p-3 text-right">الانصراف</th><th className="p-3 text-right">التأخر</th><th className="p-3 text-right">ساعات العمل</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">الجدول</th>
              </> : <>
                <th className="p-3 text-right">الملخص</th><th className="p-3 text-right">التأخر</th><th className="p-3 text-right">ساعات العمل</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className="border-t border-border/50">
                <td className="p-3">{i + 1}</td>
                <td className="p-3 font-bold">{row.name}</td>
                <td className="p-3 mono">{row.jobNumber}</td>
                {mode === "daily" ? <>
                  <td className="p-3 mono">{row.checkIn}</td><td className="p-3 mono">{row.checkOut}</td><td className="p-3 mono">{row.late} د</td><td className="p-3 mono">{formatDurationMinutes(row.worked)}</td><td className="p-3">{row.status}</td><td className="p-3 text-xs">{row.detail}</td>
                </> : <>
                  <td className="p-3 text-xs">{row.detail}</td><td className="p-3 mono">{row.late} د</td><td className="p-3 mono">{formatDurationMinutes(row.worked)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !rows.length && <div className="p-8 text-center text-muted-foreground">جاري تحميل بيانات التقارير من D1…</div>}
        {!loading && !rows.length && <div className="p-8 text-center text-muted-foreground">لا توجد بيانات موظفين في D1 لعرض التقرير.</div>}
      </div>
    </ManagerLayout>
  );
}
