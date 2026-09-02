import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Coffee, ShieldAlert, Clock3, UserCheck, UserX, Users } from "lucide-react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getDailyStatus, type DailyStatusRow } from "@/lib/dailyStatus";
import { getBackendEscapeEvents } from "@/lib/backend";
import { todayKey } from "@/lib/utils";

type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave" | "escaped";
type Tone = "all" | "present" | "absent" | "late" | "rest" | "leave" | "escaped";

function statusLabel(row: DailyStatusRow) {
  switch (row.status) {
    case "PRESENT": return "حاضر";
    case "LATE": return "متأخر";
    case "ABSENT": return "غائب";
    case "REST":
    case "NOT_STARTED": return "مستريح";
    case "LEAVE": return "إجازة";
    case "PERMISSION": return "إذن";
    case "INVALID": return "جدول غير صالح";
    default: return "غير محدد";
  }
}

function isPresent(row: DailyStatusRow) { return row.status === "PRESENT" || row.status === "LATE"; }
function isRest(row: DailyStatusRow) { return row.status === "REST" || row.status === "NOT_STARTED"; }

export default function ManagerDashboard() {
  const [rows, setRows] = useState<DailyStatusRow[]>([]);
  const [escapeEvents, setEscapeEvents] = useState<Array<{ employeeId: string; status: "escaped" | "returned" }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const today = todayKey();

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    const load = async () => {
      if (!active) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      queued = false;
      try {
        const [result, escapes] = await Promise.all([
          getDailyStatus(today),
          getBackendEscapeEvents(undefined, 2000),
        ]);
        if (!active) return;
        setRows(Array.isArray(result.employees) ? result.employees : []);
        setEscapeEvents(Array.isArray(escapes) ? escapes.map((item) => ({ employeeId: String(item.employeeId), status: item.status })) : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "تعذر مزامنة حالة الدوام من D1");
        setLoading(false);
      } finally {
        inFlight = false;
        if (active && queued) window.setTimeout(() => void load(), 0);
      }
    };
    setLoading(true);
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("hadir:cloud-data-changed", refresh as EventListener);
    window.addEventListener("hadir:d1-view-changed", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.removeEventListener("hadir:cloud-data-changed", refresh as EventListener);
      window.removeEventListener("hadir:d1-view-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [today]);

  const presentIds = useMemo(() => new Set(rows.filter(isPresent).map((row) => row.employeeId)), [rows]);
  const lateIds = useMemo(() => new Set(rows.filter((row) => row.status === "LATE").map((row) => row.employeeId)), [rows]);
  const absentIds = useMemo(() => new Set(rows.filter((row) => row.status === "ABSENT").map((row) => row.employeeId)), [rows]);
  const restIds = useMemo(() => new Set(rows.filter(isRest).map((row) => row.employeeId)), [rows]);
  const leaveIds = useMemo(() => new Set(rows.filter((row) => row.status === "LEAVE").map((row) => row.employeeId)), [rows]);
  const escapedIds = useMemo(() => {
    const latest = new Map<string, "escaped" | "returned">();
    for (const event of escapeEvents) {
      if (!latest.has(event.employeeId)) latest.set(event.employeeId, event.status);
    }
    return new Set([...latest.entries()].filter(([, status]) => status === "escaped").map(([employeeId]) => employeeId));
  }, [escapeEvents]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const id = row.employeeId;
    if (search && !row.employeeName.includes(search)) return false;
    if (filter === "present" && !presentIds.has(id)) return false;
    if (filter === "absent" && !absentIds.has(id)) return false;
    if (filter === "late" && !lateIds.has(id)) return false;
    if (filter === "rest" && !restIds.has(id)) return false;
    if (filter === "leave" && !leaveIds.has(id)) return false;
    if (filter === "escaped" && !escapedIds.has(id)) return false;
    return true;
  }), [rows, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds, escapedIds]);

  const displayDate = useMemo(() => new Date(`${today}T12:00:00+03:00`), [today]);
  const filters: Array<[Filter, string]> = [
    ["all", "الكل"], ["present", "الحاضرون"], ["absent", "الغائبون"],
    ["late", "المتأخرون"], ["rest", "المستريحون"], ["leave", "الإجازات"], ["escaped", "الهاربون"],
  ];

  return (
    <ManagerLayout title="لوحة القيادة" subtitle={`نظرة مباشرة على حالة الدوام · ${displayDate.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long", timeZone: "Asia/Damascus" })}`}>
      {error ? <section className="hud-card mb-6 border border-destructive/30 bg-destructive/5 p-4"><div className="font-bold text-destructive">تعذر مزامنة حالة الدوام من D1</div><div className="mt-1 text-xs text-muted-foreground">{error}</div></section> : null}

      <section className="hud-card mb-6 p-4">
        <div className="text-sm font-extrabold">الحالة التشغيلية الحالية</div>
        <div className="mt-1 text-xs text-muted-foreground">هذه لوحة تشغيل مباشرة لليوم الحالي. الموظف يُقيّم وفق جدول دوامه الفعلي؛ يوم الراحة لا يُحتسب غيابًا، والنوبة التناوبية الممتدة تبقى فعالة طوال فترة العمل.</div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="حالات الدوام">
        <StatusShortcut label="إجمالي الموظفين" value={rows.length} icon={<Users className="h-5 w-5" aria-hidden="true" />} tone="all" onClick={() => setFilter("all")} active={filter === "all"} />
        <StatusShortcut label="الحضور" value={presentIds.size} icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} tone="present" onClick={() => setFilter("present")} active={filter === "present"} />
        <StatusShortcut label="الغياب" value={absentIds.size} icon={<UserX className="h-5 w-5" aria-hidden="true" />} tone="absent" onClick={() => setFilter("absent")} active={filter === "absent"} />
        <StatusShortcut label="المتأخرون" value={lateIds.size} icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} tone="late" onClick={() => setFilter("late")} active={filter === "late"} />
        <StatusShortcut label="الراحة" value={restIds.size} icon={<Coffee className="h-5 w-5" aria-hidden="true" />} tone="rest" onClick={() => setFilter("rest")} active={filter === "rest"} />
        <StatusShortcut label="الإجازات" value={leaveIds.size} icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} tone="leave" onClick={() => setFilter("leave")} active={filter === "leave"} />
        <StatusShortcut label="الهروب" value={escapedIds.size} icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />} tone="escaped" onClick={() => setFilter("escaped")} active={filter === "escaped"} />
      </section>

      <section className="hud-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">حالة الموظفين الحالية</div>
            <div className="mt-1 text-xs text-muted-foreground">المصدر: D1 · attendance + employees + requests + escape_events · Asia/Damascus</div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{label}</button>)}
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم الموظف" className="min-w-[180px] flex-1 rounded-lg border bg-secondary/50 px-3 py-1.5 text-sm" />
        </div>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">جاري مزامنة الحالة الحالية من D1…</div> : filteredRows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredRows.map((row) => <EmployeeRow key={row.employeeId} row={row} escaped={escapedIds.has(row.employeeId)} />)}</div>}
      </section>
    </ManagerLayout>
  );
}

const EmployeeRow = memo(function EmployeeRow({ row, escaped }: { row: DailyStatusRow; escaped: boolean }) {
  const status = escaped ? "هارب" : statusLabel(row);
  const present = !escaped && isPresent(row);
  const rest = !escaped && isRest(row);
  const leave = !escaped && row.status === "LEAVE";
  const absent = !escaped && row.status === "ABSENT";
  const late = !escaped && row.status === "LATE";
  const cls = escaped ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cls}`}><div className="min-w-0"><span className="block truncate font-semibold" title={row.employeeName}>{row.employeeName}</span><span className="mt-0.5 block text-[10px] opacity-70">{row.scheduleType === "ROTATION" ? "تناوبي" : "ثابت"}{row.jobNumber ? ` · ${row.jobNumber}` : ""}</span></div><span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[11px] font-bold">{status}</span></div>;
});

function StatusShortcut({ label, value, icon, tone, onClick, active }: { label: string; value: number; icon: ReactNode; tone: Tone; onClick: () => void; active: boolean }) {
  const style = tone === "all" ? "border-border bg-secondary/30 text-foreground" : tone === "present" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : tone === "absent" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : tone === "late" ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : tone === "leave" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  return <button type="button" onClick={onClick} aria-pressed={active} className={`hud-card flex min-h-[116px] items-center justify-between gap-3 p-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${style} ${active ? "ring-2 ring-primary/40" : ""}`}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70" aria-hidden="true">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold">{label}</span>
      <span className="mt-1 block text-2xl font-black mono">{value}</span>
      <span className="mt-1 block text-[10px] font-semibold opacity-70">عرض القائمة</span>
    </span>
  </button>;
}
