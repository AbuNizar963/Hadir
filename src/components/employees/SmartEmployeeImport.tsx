import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Wand2, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backendEnabled, createBackendEmployee, getBackendEmployees, getBackendLocations } from "@/lib/backend";
import { getEmployees, saveEmployees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import { XLSX as ExportXLSX, autoFitColumns, styleExcelTable, styleReportWorkbook, setExcelRtl, type ExcelCell } from "@/lib/excelExport";
import type { Employee, ScheduleType } from "@/types";

type Row = Record<string, unknown>;
type Mapping = {
  name: string;
  jobNumber: string;
  status?: string;
  scheduleType?: string;
  workStartTime?: string;
  workEndTime?: string;
  gracePeriodMinutes?: string;
  workDays?: string;
  rotationDaysOn?: string;
  rotationDaysOff?: string;
  rotationStartDate?: string;
  locationId?: string;
  specialties?: string;
  isVip?: string;
  autoCheckIn?: string;
  autoCheckOut?: string;
};
type PreviewRow = { name: string; jobNumber: string; valid: boolean; duplicate: boolean };

const text = (v: unknown) => String(v ?? "").trim();
const normalize = (v: unknown) => text(v).toLowerCase().replace(/[\s_\-./\\()\[\]{}:]+/g, "");
const isLikelyName = (v: unknown) => { const s = text(v); return s.length >= 3 && s.length <= 90 && !/^\d+$/.test(s) && /[A-Za-z\u0600-\u06FF]/.test(s); };
const isLikelyJob = (v: unknown) => { const s = text(v); return s.length >= 2 && s.length <= 30 && /^[A-Za-z0-9٠-٩\-_/]+$/.test(s) && /\d/.test(s); };

const aliases = {
  name: ["name", "fullname", "full_name", "employee_name", "employeename", "اسم", "اسم الموظف", "الاسم", "الاسم الكامل"],
  job: ["jobnumber", "job_number", "employeenumber", "employee_number", "employeeid", "employee_id", "number", "رقم", "الرقم الوظيفي", "الرقم الوظيفى", "رقم الموظف", "الرقم"],
  status: ["status", "الحالة", "حالة الموظف"],
  scheduleType: ["scheduletype", "schedule_type", "نوع الدوام", "نوع الجدول", "الدوام"],
  workStartTime: ["workstarttime", "work_start_time", "starttime", "وقت بداية الدوام", "بداية الدوام"],
  workEndTime: ["workendtime", "work_end_time", "endtime", "وقت نهاية الدوام", "نهاية الدوام"],
  gracePeriodMinutes: ["graceperiodminutes", "grace_period_minutes", "grace", "السماح", "دقائق السماح", "فترة السماح"],
  workDays: ["workdays", "work_days", "أيام الدوام", "أيام العمل"],
  rotationDaysOn: ["rotationdayson", "rotation_days_on", "أيام العمل التناوبي", "أيام العمل في التناوب"],
  rotationDaysOff: ["rotationdaysoff", "rotation_days_off", "أيام الراحة التناوبي", "أيام الراحة في التناوب"],
  rotationStartDate: ["rotationstartdate", "rotation_start_date", "بداية التناوب", "تاريخ بداية التناوب"],
  locationId: ["locationid", "location_id", "معرف الموقع", "معرف موقع العمل"],
  specialties: ["specialties", "التخصصات", "التخصص"],
  isVip: ["isvip", "is_vip", "vip", "vip", "مميز"],
  autoCheckIn: ["autocheckin", "auto_check_in", "التحضير التلقائي", "حضور تلقائي"],
  autoCheckOut: ["autocheckout", "auto_check_out", "الانصراف التلقائي", "انصراف تلقائي"],
} as const;

function scoreHeader(value: unknown, words: readonly string[]) { const n = normalize(value); return words.some(w => normalize(w) === n) ? 100 : words.some(w => n.includes(normalize(w))) ? 60 : 0; }
function findHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const row = matrix[i] || [];
    const hasName = row.some(v => scoreHeader(v, aliases.name) >= 60);
    const hasJob = row.some(v => scoreHeader(v, aliases.job) >= 60);
    if (hasName && hasJob) return i;
  }
  throw new Error("تعذر العثور على صف عناوين الموظفين. استخدم ملف Excel/CSV صادرًا من النظام أو ملفًا يحتوي على الاسم والرقم الوظيفي.");
}

function detectMapping(rows: Row[]): Mapping {
  if (!rows.length) throw new Error("الملف لا يحتوي على بيانات.");
  const keys = Object.keys(rows[0]);
  const required = (words: readonly string[], label: string) => {
    const ranked = keys.map(k => [scoreHeader(k, words), k] as const).sort((a, b) => b[0] - a[0]);
    const hit = ranked.find(x => x[0] > 0)?.[1];
    if (hit) return hit;
    throw new Error(`تعذر تحديد عمود ${label}.`);
  };
  const optional = (words: readonly string[]) => {
    const ranked = keys.map(k => [scoreHeader(k, words), k] as const).sort((a, b) => b[0] - a[0]);
    return ranked[0]?.[0] ? ranked[0][1] : undefined;
  };
  const name = required(aliases.name, "الاسم");
  const jobNumber = required(aliases.job, "الرقم الوظيفي");
  return {
    name, jobNumber,
    status: optional(aliases.status), scheduleType: optional(aliases.scheduleType),
    workStartTime: optional(aliases.workStartTime), workEndTime: optional(aliases.workEndTime),
    gracePeriodMinutes: optional(aliases.gracePeriodMinutes), workDays: optional(aliases.workDays),
    rotationDaysOn: optional(aliases.rotationDaysOn), rotationDaysOff: optional(aliases.rotationDaysOff),
    rotationStartDate: optional(aliases.rotationStartDate), locationId: optional(aliases.locationId),
    specialties: optional(aliases.specialties), isVip: optional(aliases.isVip),
    autoCheckIn: optional(aliases.autoCheckIn), autoCheckOut: optional(aliases.autoCheckOut),
  };
}

function parseBool(value: unknown, fallback = false) {
  const n = normalize(value);
  if (["1", "true", "yes", "y", "on", "نعم", "مفعل", "فعال", "مميز", "vip"].includes(n)) return true;
  if (["0", "false", "no", "n", "off", "لا", "غيرمفعل", "موقوف"].includes(n)) return false;
  return fallback;
}
function parseNumber(value: unknown, fallback: number) {
  const normalized = String(value ?? "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}
function parseSchedule(value: unknown): ScheduleType { const n = normalize(value); return n.includes("تناوب") || n === "rotation" ? "ROTATION" : "ADMIN"; }
function parseStatus(value: unknown): "active" | "suspended" { const n = normalize(value); return ["موقوف", "suspended", "inactive", "غيرفعال"].includes(n) ? "suspended" : "active"; }
function parseDays(value: unknown) {
  const raw = text(value); if (!raw) return [0, 1, 2, 3, 4];
  const map: Record<string, number> = { الأحد: 0, الاثنين: 1, الثلاثاء: 2, الأربعاء: 3, الخميس: 4, الجمعة: 5, السبت: 6 };
  const result = raw.split(/[,،|;/]+/).map(v => v.trim()).flatMap(v => { if (/^\d+$/.test(v)) return [Math.max(0, Math.min(6, Number(v)))]; return map[v] == null ? [] : [map[v]]; });
  return result.length ? [...new Set(result)].sort((a, b) => a - b) : [0, 1, 2, 3, 4];
}
function parseSpecialties(value: unknown) { const result = text(value).split(/[,،|;/]+/).map(v => v.trim()).filter(Boolean); return result.length ? [...new Set(result)] : ["general"]; }

function exportEmployees(rows: Employee[]) {
  const headers = [
    "الاسم", "الرقم الوظيفي", "نوع الدوام", "الحالة", "وقت بداية الدوام", "وقت نهاية الدوام",
    "دقائق السماح", "أيام الدوام", "أيام العمل التناوبي", "أيام الراحة التناوبي", "تاريخ بداية التناوب",
    "معرف الموقع", "التخصصات", "VIP", "التحضير التلقائي", "الانصراف التلقائي",
  ] as ExcelCell[];
  const body: ExcelCell[][] = rows.map(e => [
    e.name, e.jobNumber, e.scheduleType === "ROTATION" ? "تناوبي" : "إداري", e.status === "active" ? "فعال" : "موقوف",
    e.workStartTime ?? e.rotationStartTime ?? "", e.workEndTime ?? e.rotationEndTime ?? "", e.gracePeriodMinutes ?? 15,
    (e.workDays ?? [0, 1, 2, 3, 4]).join(","), e.rotationDaysOn ?? "", e.rotationDaysOff ?? "", e.rotationStartDate ?? "",
    e.locationId ?? "", (e.specialties ?? []).join(", "), e.isVip ? "نعم" : "لا", e.autoCheckIn ? "نعم" : "لا", e.autoCheckOut ? "نعم" : "لا",
  ]);
  const wb = ExportXLSX.utils.book_new();
  const ws = ExportXLSX.utils.aoa_to_sheet([["Hadir Employee Export v2"], [`بيانات الموظفين - ${new Date().toLocaleDateString("ar-SA")}`], [], headers, ...body]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }];
  ws["!autofilter"] = { ref: `A4:${ExportXLSX.utils.encode_col(headers.length - 1)}${Math.max(4, body.length + 4)}` };
  styleExcelTable(ws, 3, body.length + 3, 0, headers.length - 1, 2, 0);
  styleReportWorkbook(ws, undefined, 4, body.length + 3);
  autoFitColumns(ws, [headers, ...body], 12, 42);
  setExcelRtl(wb, ws);
  ExportXLSX.utils.book_append_sheet(wb, ws, "الموظفون");
  ExportXLSX.writeFile(wb, `Hadir-Employees-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function SmartEmployeeImport({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [mapping, setMapping] = useState<Mapping | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]); const [rows, setRows] = useState<Row[]>([]); const [message, setMessage] = useState(""); const [exporting, setExporting] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return; setBusy(true); setError(""); setMessage("");
    try {
      const data = await file.arrayBuffer(); const wb = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]]; if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      const headerRow = findHeaderRow(matrix); const parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false, range: headerRow });
      const m = detectMapping(parsed); const existing = backendEnabled ? await getBackendEmployees() : getEmployees();
      const jobs = new Set(existing.map(e => text(e.jobNumber).toLowerCase())); const seen = new Set<string>();
      const p = parsed.map(r => { const name = text(r[m.name]); const job = text(r[m.jobNumber]); const key = job.toLowerCase(); const valid = !!name && !!job && isLikelyName(name) && isLikelyJob(job); const duplicate = !!job && (jobs.has(key) || seen.has(key)); if (job) seen.add(key); return { name, jobNumber: job, valid, duplicate }; });
      setMapping(m); setRows(parsed); setPreview(p);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحليل الملف."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const confirmImport = async () => {
    if (!mapping) return; setBusy(true); setError("");
    try {
      const existing = backendEnabled ? await getBackendEmployees() : getEmployees(); const jobs = new Set(existing.map(e => text(e.jobNumber).toLowerCase()));
      const locations = backendEnabled ? await getBackendLocations() : []; const defaultLocation = locations.find(l => l.id === "main")?.id || locations[0]?.id || "main";
      let added = 0, skipped = 0, invalid = 0;
      for (const row of rows) {
        const name = text(row[mapping.name]); const jobNumber = text(row[mapping.jobNumber]);
        if (!name || !jobNumber || !isLikelyName(name) || !isLikelyJob(jobNumber)) { invalid++; continue; }
        const key = jobNumber.toLowerCase(); if (jobs.has(key)) { skipped++; continue; }
        const scheduleType = mapping.scheduleType ? parseSchedule(row[mapping.scheduleType]) : "ADMIN";
        const status = mapping.status ? parseStatus(row[mapping.status]) : "active";
        const workStartTime = mapping.workStartTime ? text(row[mapping.workStartTime]) || "08:00" : "08:00";
        const workEndTime = mapping.workEndTime ? text(row[mapping.workEndTime]) || "16:00" : "16:00";
        const gracePeriodMinutes = mapping.gracePeriodMinutes ? Math.max(0, Math.round(parseNumber(row[mapping.gracePeriodMinutes], 15))) : 15;
        const workDays = mapping.workDays ? parseDays(row[mapping.workDays]) : [0, 1, 2, 3, 4];
        const rotationDaysOn = mapping.rotationDaysOn ? Math.max(1, Math.round(parseNumber(row[mapping.rotationDaysOn], 7))) : 7;
        const rotationDaysOff = mapping.rotationDaysOff ? Math.max(1, Math.round(parseNumber(row[mapping.rotationDaysOff], 7))) : 7;
        const rotationStartDate = mapping.rotationStartDate ? text(row[mapping.rotationStartDate]) || null : null;
        const locationId = mapping.locationId ? text(row[mapping.locationId]) || defaultLocation : defaultLocation;
        const specialties = mapping.specialties ? parseSpecialties(row[mapping.specialties]) : ["general"];
        const isVip = mapping.isVip ? parseBool(row[mapping.isVip]) : false;
        const autoCheckIn = mapping.autoCheckIn ? parseBool(row[mapping.autoCheckIn]) : false;
        const autoCheckOut = mapping.autoCheckOut ? parseBool(row[mapping.autoCheckOut]) : false;
        const common = { name, jobNumber, pin: jobNumber, status, deviceId: null, deviceLabel: null, scheduleType, workStartTime, workEndTime, gracePeriodMinutes, rotationStartDate, workDays, rotationDaysOn, rotationDaysOff, avatar: null, role: "staff" as const, locationId, specialties, isVip, autoCheckIn, autoCheckOut };
        if (backendEnabled) await createBackendEmployee(common as Parameters<typeof createBackendEmployee>[0]);
        else { const emp: Employee = { id: generateId(), pinHash: hash(jobNumber), createdAt: new Date().toISOString(), ...common }; saveEmployees([emp, ...getEmployees()], { [emp.id]: jobNumber }); }
        jobs.add(key); added++;
      }
      setMessage(`تم الاستيراد: ${added} موظف، ${skipped} مكرر، ${invalid} صف غير صالح.`); setMapping(null); setRows([]); setPreview([]); onImported?.();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر استيراد الموظفين."); }
    finally { setBusy(false); }
  };

  const handleExport = async () => { setExporting(true); setError(""); try { const employees = backendEnabled ? await getBackendEmployees() : getEmployees(); exportEmployees(employees); } catch (e) { setError(e instanceof Error ? e.message : "تعذر تصدير الموظفين."); } finally { setExporting(false); } };
  const valid = preview.filter(r => r.valid && !r.duplicate).length; const duplicate = preview.filter(r => r.duplicate).length; const invalid = preview.filter(r => !r.valid).length;

  return <div className="space-y-3 rounded-lg border p-3">
    <div className="flex flex-wrap gap-2">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={e => void handleFile(e.target.files?.[0])}/>
      <Button type="button" variant="outline" disabled={busy || exporting} onClick={() => inputRef.current?.click()}><FileSpreadsheet className="ml-2 h-4 w-4"/>{busy ? "جاري التحليل…" : "استيراد Excel / CSV"}<Wand2 className="mr-2 h-4 w-4"/></Button>
      <Button type="button" variant="outline" disabled={busy || exporting} onClick={() => void handleExport()}><Download className="ml-2 h-4 w-4"/>{exporting ? "جاري تجهيز Excel…" : "تصدير الموظفين الذكي"}</Button>
      {mapping && <Button type="button" disabled={busy || valid === 0} onClick={() => void confirmImport()}>{busy ? "جاري الاستيراد…" : "تأكيد الاستيراد"}</Button>}
    </div>
    {mapping && <><div className="text-sm">تم التعرف تلقائيًا: <b>الاسم</b> = {mapping.name}، <b>الرقم الوظيفي</b> = {mapping.jobNumber}</div><div className="text-xs text-muted-foreground">لا يتم تصدير الرقم الذاتي أو كلمة المرور أو معرف الجهاز. عند الاستيراد يُنشأ رمز PIN افتراضي يساوي الرقم الوظيفي.</div><div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded border p-2"><CheckCircle2 className="inline h-4 w-4"/> صالح: {valid}</div><div className="rounded border p-2"><AlertTriangle className="inline h-4 w-4"/> مكرر: {duplicate}</div><div className="rounded border p-2">غير صالح: {invalid}</div></div><div className="max-h-56 overflow-auto rounded border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-right">الاسم</th><th className="p-2 text-right">الرقم الوظيفي</th><th className="p-2 text-right">الحالة</th></tr></thead><tbody>{preview.slice(0, 100).map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.name || "—"}</td><td className="p-2">{r.jobNumber || "—"}</td><td className="p-2">{!r.valid ? "❌ ناقص/غير صالح" : r.duplicate ? "⚠️ مكرر" : "✅ جاهز"}</td></tr>)}</tbody></table></div></>}
    {message && <div className="text-sm text-emerald-600">{message}</div>}{error && <div className="text-sm text-destructive">{error}</div>}
  </div>;
}
