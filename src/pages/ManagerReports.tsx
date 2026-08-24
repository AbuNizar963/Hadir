import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { XLSX, autoFitColumns, styleExcelTable, styleReportWorkbook, setExcelRtl, type ExcelCell } from "@/lib/excelExport";
import { getAttendance, getEmployees, getSettings } from "@/lib/storage";
import { getBackendAttendance, getBackendEmployees, getBackendEscapeEvents } from "@/lib/backend";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import { formatDate, formatDurationMinutes, formatTime, minutesBetween } from "@/lib/utils";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import { FileSpreadsheet, FileText, Wand2, ShieldAlert, QrCode, IdCard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord, Employee, EscapeEvent } from "@/types";

type Mode = "daily" | "monthly" | "annual";
type ReportRow = { key: string; name: string; jobNumber: string; checkIn: string; checkOut: string; late: number; worked: number; status: string; detail: string; scheduled: boolean };

function dateAtNoon(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function findSession(records: AttendanceRecord[], employee: Employee, start: Date | null, end: Date | null) {
  if (!start) return { checkIn: undefined, checkOut: undefined };
  const sorted = records.filter(r => r.employeeId === employee.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let checkIn: AttendanceRecord | undefined;
  let checkOut: AttendanceRecord | undefined;
  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime();
    if (r.type === "check-in" && t >= start.getTime() && (!end || t <= end.getTime() + 60000)) { checkIn = r; checkOut = undefined; }
    else if (r.type === "check-out" && checkIn && t >= new Date(checkIn.timestamp).getTime() && (!end || t <= end.getTime() + 60000)) { checkOut = r; break; }
  }
  return { checkIn, checkOut };
}

function statusClass(status: string) {
  if (status === "مكتمل") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "غياب") return "bg-red-500/15 text-red-700 dark:text-red-300";
  if (status.includes("بدون")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
}
function Status({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(value)}`}>{value || "—"}</span>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3 text-right font-bold whitespace-nowrap">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 text-right ${className}`}>{children}</td>; }

export default function ManagerReports() {
  const [mode, setMode] = useState<Mode>("daily");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(getAttendance());
  const [escapeEvents, setEscapeEvents] = useState<EscapeEvent[]>([]);
  const [cardEmployee, setCardEmployee] = useState<Employee | null>(null);
  const settings = getSettings();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Reports must read employees from D1, not the legacy localStorage cache.
        // ManagerLogin already stores the authenticated admin API token.
        const [liveEmployees, liveAttendance, escapes] = await Promise.all([
          getBackendEmployees(),
          getBackendAttendance(2000),
          getBackendEscapeEvents(undefined, 2000),
        ]);
        if (cancelled) return;
        if (Array.isArray(liveEmployees)) setEmployees(liveEmployees);
        if (Array.isArray(liveAttendance)) setAttendance(liveAttendance);
        if (Array.isArray(escapes)) setEscapeEvents(escapes);
      } catch {
        // Keep the local cache only as a fallback when the backend is unavailable.
        if (!cancelled) { setEmployees(getEmployees()); setAttendance(getAttendance()); }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const rows = useMemo<ReportRow[]>(() => {
    if (mode === "daily") {
      const target = dateAtNoon(date);
      return employees.map(e => {
        const period = getEmployeeWorkPeriod(e, target);
        if (!period.isWorkDay) return { key: e.id, name: e.name, jobNumber: e.jobNumber, checkIn: "—", checkOut: "—", late: 0, worked: 0, status: "راحة", detail: period.detail || "لا يوجد دوام مجدول", scheduled: false };
        const s = findSession(attendance, e, period.start, period.end);
        const late = s.checkIn && period.start ? Math.max(0, Math.round((new Date(s.checkIn.timestamp).getTime() - period.start.getTime()) / 60000) - (e.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10)) : 0;
        const status = !s.checkIn ? "غياب" : !s.checkOut ? "حاضر · بدون انصراف" : "مكتمل";
        return { key: e.id, name: e.name, jobNumber: e.jobNumber, checkIn: s.checkIn ? formatTime(s.checkIn.timestamp) : "—", checkOut: s.checkOut ? formatTime(s.checkOut.timestamp) : "—", late, worked: s.checkIn ? minutesBetween(s.checkIn.timestamp, s.checkOut?.timestamp ?? new Date().toISOString()) : 0, status, detail: period.detail || "يوم عمل", scheduled: true };
      });
    }
    const [startYear, startMonth] = mode === "monthly" ? month.split("-").map(Number) : [Number(year), 1];
    const dayCount = mode === "monthly" ? new Date(startYear, startMonth, 0).getDate() : (new Date(startYear, 1, 29).getMonth() === 1 ? 366 : 365);
    const firstMonth = mode === "monthly" ? startMonth - 1 : 0;
    const totalDays = mode === "monthly" ? dayCount : 12;
    return employees.map(e => {
      let workDays = 0, offDays = 0, absent = 0, completed = 0, open = 0, totalWorked = 0, totalLate = 0;
      const months = mode === "monthly" ? [firstMonth] : Array.from({ length: 12 }, (_, i) => i);
      for (const mo of months) {
        const days = mode === "monthly" ? totalDays : new Date(startYear, mo + 1, 0).getDate();
        for (let d = 1; d <= days; d++) {
          const target = new Date(startYear, mo, d, 12);
          const p = getEmployeeWorkPeriod(e, target);
          if (!p.isWorkDay) { offDays++; continue; }
          workDays++;
          const s = findSession(attendance, e, p.start, p.end);
          if (!s.checkIn) absent++;
          else if (!s.checkOut) open++;
          else { completed++; totalWorked += minutesBetween(s.checkIn.timestamp, s.checkOut.timestamp); }
          if (s.checkIn && p.start) totalLate += Math.max(0, Math.round((new Date(s.checkIn.timestamp).getTime() - p.start.getTime()) / 60000) - (e.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10));
        }
      }
      return { key: e.id, name: e.name, jobNumber: e.jobNumber, checkIn: "", checkOut: "", late: totalLate, worked: totalWorked, status: completed ? "مكتمل" : absent ? "غياب" : "—", detail: `عمل مجدول: ${workDays} · راحة: ${offDays} · غياب: ${absent} · مكتمل: ${completed} · مفتوح: ${open}`, scheduled: workDays > 0 };
    });
  }, [mode, date, month, year, employees, attendance, settings]);

  const exportExcel = () => {
    const daily = mode === "daily";
    const headers = daily ? ["م", "الموظف", "الرقم الوظيفي", "الحضور", "الانصراف", "التأخر (دقيقة)", "ساعات العمل", "الحالة", "تفاصيل الجدول"] : ["م", "الموظف", "الرقم الوظيفي", "ملخص الجدول", "إجمالي التأخر (دقيقة)", "إجمالي ساعات العمل"];
    const data: ExcelCell[][] = rows.map((r, i) => daily ? [i + 1, r.name, r.jobNumber, r.checkIn, r.checkOut, r.late, formatDurationMinutes(r.worked), r.status, r.detail] : [i + 1, r.name, r.jobNumber, r.detail, r.late, formatDurationMinutes(r.worked)]);
    const title = daily ? `تقرير الحضور اليومي - ${formatDate(date)}` : mode === "monthly" ? `تقرير الحضور الشهري - ${month}` : `تقرير الحضور السنوي - ${year}`;
    const ws = XLSX.utils.aoa_to_sheet([[title], [], headers, ...data]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws["!autofilter"] = { ref: `A3:${XLSX.utils.encode_col(headers.length - 1)}${3 + data.length}` };
    autoFitColumns(ws, [headers, ...data], 10, 45);
    styleExcelTable(ws, 2, 2 + data.length, 0, headers.length - 1, 3, 0);
    styleReportWorkbook(ws, daily ? 7 : undefined, 3, 2 + data.length);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, daily ? "تقرير يومي" : mode === "monthly" ? "تقرير شهري" : "تقرير سنوي");
    setExcelRtl(wb, ws);
    const output = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true });
    const url = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a"); link.href = url; link.download = `Hadir-${mode}-report-${mode === "daily" ? date : mode === "monthly" ? month : year}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportCsv = () => {
    const headers: string[] = mode === "daily" ? ["م", "الموظف", "الرقم الوظيفي", "الحضور", "الانصراف", "التأخر", "ساعات العمل", "الحالة", "تفاصيل الجدول"] : ["م", "الموظف", "الرقم الوظيفي", "ملخص الجدول", "إجمالي التأخر", "إجمالي ساعات العمل"];
    const body: CsvCell[][] = rows.map((r, i) => mode === "daily" ? [i + 1, r.name, r.jobNumber, r.checkIn, r.checkOut, r.late, formatDurationMinutes(r.worked), r.status, r.detail] : [i + 1, r.name, r.jobNumber, r.detail, r.late, formatDurationMinutes(r.worked)]);
    downloadCSV(`Hadir-${mode}-report-${mode === "daily" ? date : mode === "monthly" ? month : year}`, headers, body);
  };
  const exportEscapeCsv = () => downloadCSV(`Hadir-escape-events-${date}`, ["م", "الموظف", "الرقم الوظيفي", "الحالة", "التاريخ والوقت", "السبب"], escapeEvents.map((e, i) => [i + 1, e.employeeName, e.jobNumber, e.status === "escaped" ? "هروب" : "عودة", `${formatDate(e.timestamp)} ${formatTime(e.timestamp)}`, e.reason || ""]));

  const periodLabel = mode === "daily" ? `تقرير يومي · ${formatDate(date)}` : mode === "monthly" ? `تقرير شهري · ${month}` : `تقرير سنوي · ${year}`;
  return <ManagerLayout title="التقارير" subtitle={periodLabel} actions={<div className="flex flex-wrap gap-2"><Button onClick={exportExcel}><FileSpreadsheet className="ml-2 h-4 w-4" />تصدير Excel ذكي</Button><Button onClick={exportCsv} variant="outline"><FileText className="ml-2 h-4 w-4" />CSV</Button><Button onClick={exportEscapeCsv} variant="outline"><ShieldAlert className="ml-2 h-4 w-4" />سجل الهروب</Button></div>}>
    <div className="hud-card p-4 mb-5 space-y-3"><div className="flex flex-wrap items-center gap-3"><div className="inline-flex bg-secondary/50 rounded-xl p-1 border border-border/50">{(["daily", "monthly", "annual"] as Mode[]).map(m => <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m === "daily" ? "يومي" : m === "monthly" ? "شهري" : "سنوي"}</button>)}</div>{mode === "daily" ? <input aria-label="تاريخ التقرير" type="date" className="input max-w-[200px] mono" value={date} onChange={e => setDate(e.target.value)} /> : mode === "monthly" ? <input aria-label="شهر التقرير" type="month" className="input max-w-[200px] mono" value={month} onChange={e => setMonth(e.target.value)} /> : <input aria-label="سنة التقرير" type="number" min="2000" max="2100" className="input max-w-[140px] mono" value={year} onChange={e => setYear(e.target.value)} />}</div><div className="flex items-center gap-2 text... (rest unchanged)