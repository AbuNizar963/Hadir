import { memo, useEffect, useMemo, useState } from "react";
import { CalendarDays, Coffee } from "lucide-react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getDailyStatus, type DailyStatusRow } from "@/lib/dailyStatus";
import { todayKey } from "@/lib/utils";

type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave";

function statusLabel(row: DailyStatusRow) {
  switch (row.status) {
    case "PRESENT": return "حاضر";
    case "LATE": return "متأخر";
    case "ABSENT": return "غائب";
    case "REST":
    case "NOT_STARTED": return "مستريح";
    case "LEAVE": return "إجازة";
    case "INVALID": return "جدول غير صالح";
    default: return "غير محدد";
  }
}

function isPresent(row: DailyStatusRow) { return row.status === "PRESENT" || row.status === "LATE"; }
function isRest(row: DailyStatusRow) { return row.status === "REST" || row.status === "NOT_STARTED"; }

export default function ManagerDashboard() {
  const [rows, setRows] = useState<DailyStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const today = todayKey();

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await getDailyStatus(today);
        if (!active) return;
        setRows(Array.isArray(result.employees) ? result.employees : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "تعذر مزامنة حالة الدوام من D1");
        setLoading(false);
      } finally {
        inFlight = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 5000);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [today]);

  const presentIds = useMemo(() => new Set(rows.filter(isPresent).map((row) => row.employeeId)), [rows]);
  const lateIds = useMemo(() => new Set(rows.filter((row) => row.status === "LATE").map((row) => row.employeeId)), [rows]);
  const absentIds = useMemo(() => new Set(rows.filter((row) => row.status === "ABSENT").map((row) => row.employeeId)), [rows]);
  const restIds = useMemo(() => new Set(rows.filter(isRest).map((row) => row.employeeId)), [rows]);
  const leaveIds = useMemo(() => new Set(rows.filter((row) => row.status === "LEAVE").map((row) => row.employeeId)), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const id = row.employeeId;
    if (search && !row.employeeName.includes(search)) return false;
    if (filter === "present" && !presentIds.has(id)) return false;
    if (filter === "absent" && !absentIds.has(id)) return false;
    if (filter === "late" && !lateIds.has(id)) return false;
    if (filter === "rest" && !restIds.has(id)) return false;
    if (filter === "leave" && !leaveIds.has(id)) return false;
    return true;
  }), [rows, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds]);

  const targetDate = useMemo(() => new Date(`${today}T12:00:00+03:00`), [today]);
  const filters: Array<[Filter, string]> = [
    ["all", "الكل"], ["present", "الحاضرون"], ["absent", "الغائبون"],
    ["late", "المتأخرون"], ["rest", "المستريحون"], ["leave", "الإجازات"],
  ];

  return (
    <ManagerLayout title="لوحة القيادة" subtitle={`نظرة مباشرة على حالة الدوام اليوم · ${targetDate.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long", timeZone: "Asia/Damascus" })}`}>
      {error ? <section className="hud-card border border-destructive/30 bg-destructive/5 p-4 mb-6"><div className="font-bold text-destructive">تعذر مزامنة حالة الدوام من D1</div><div className="mt-1 text-xs text-muted-foreground">{error}</div></section> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Kpi label="إجمالي الموظفين" value={rows.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب اليوم" value={absentIds.size} accent="warning" />
        <Kpi label="متأخرون" value={lateIds.size} accent="destructive" />
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6" aria-label="الراحة والإجازات">
        <StatusShortcut label="الراحة" value={restIds.size} icon={<Coffee className="h-5 w-5" aria-hidden="true" />} tone="rest" onClick={() => setFilter("rest")} active={filter === "rest"} />
        <StatusShortcut label="الإجازات" value={leaveIds.size} icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} tone="leave" onClick={() => setFilter("leave")} active={filter === "leave"} />
      </section>

      <section className="hud-card p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold">ملخص اليوم</h2>
            <p className="text-xs text-muted-foreground mt-1">D1 هو مصدر الحقيقة: الموظف خارج جدوله أو في يوم OFF لا يُحتسب غائبًا.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <StatusCard label="حاضر" value={presentIds.size} tone="present" />
          <StatusCard label="غائب" value={absentIds.size} tone="absent" />
          <StatusCard label="متأخر" value={lateIds.size} tone="late" />
          <StatusCard label="راحة" value={restIds.size} tone="rest" />
          <StatusCard label="إجازة" value={leaveIds.size} tone="leave" />
        </div>
      </section>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold">حالة الموظفين اليوم</div>
            <div className="text-xs text-muted-foreground mt-1">المصدر: D1 · attendance + employees + leave_requests · Asia/Damascus</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{label}</button>)}
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم الموظف" className="min-w-[180px] flex-1 rounded-lg border bg-secondary/50 px-3 py-1.5 text-sm" />
        </div>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">جاري مزامنة حالة الدوام من D1…</div> : filteredRows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredRows.map((row) => <EmployeeRow key={row.employeeId} row={row} />)}</div>}
      </section>
    </ManagerLayout>
  );
}

const EmployeeRow = memo(function EmployeeRow({ row }: { row: DailyStatusRow }) {
  const status = statusLabel(row);
  const present = isPresent(row);
  const rest = isRest(row);
  const leave = row.status === "LEAVE";
  const absent = row.status === "ABSENT";
  const late = row.status === "LATE";
  const cls = present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cls}`}><div className="min-w-0"><span className="block truncate font-semibold" title={row.employeeName}>{row.employeeName}</span><span className="mt-0.5 block text-[10px] opacity-70">{row.scheduleType === "ROTATION" ? "تناوبي" : "ثابت"}{row.jobNumber ? ` · ${row.jobNumber}` : ""}</span></div><span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[11px] font-bold">{status}</span></div>;
});

const Kpi = memo(function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "warning" | "destructive" }) {
  const color = accent === "primary" ? "text-primary" : accent === "warning" ? "text-[hsl(var(--warning))]" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return <div className="hud-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-3xl font-extrabold mono ${color}`}>{value}</div></div>;
});

function StatusShortcut({ label, value, icon, tone, onClick, active }: { label: string; value: number; icon: React.ReactNode; tone: "rest" | "leave"; onClick: () => void; active: boolean }) {
  const style = tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300";
  return <button type="button" onClick={onClick} aria-pressed={active} className={`hud-card flex items-center justify-between gap-3 p-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${style} ${active ? "ring-2 ring-primary/40" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70" aria-hidden="true">{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{label}</span><span className="mt-1 block text-2xl font-black mono">{value}</span></span><span className="text-[10px] font-semibold opacity-70">عرض القائمة</span></button>;
}

function StatusCard({ label, value, tone }: { label: string; value: number; tone: "present" | "absent" | "late" | "rest" | "leave" }) {
  const style = tone === "present" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : tone === "absent" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : tone === "leave" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return <div className={`rounded-xl border p-4 ${style}`}><div className="text-xs font-bold">{label}</div><div className="mt-1 text-2xl font-black mono">{value}</div></div>;
}
