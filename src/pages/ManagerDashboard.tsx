import { memo, useEffect, useMemo, useState } from "react";
import { CalendarDays, Coffee, Database, RefreshCw, AlertTriangle } from "lucide-react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendAttendance, getBackendEmployees } from "@/lib/backend";
import { getSettings } from "@/lib/storage";
import { workforce } from "@/lib/workforce";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import type { AttendanceRecord, Employee } from "@/types";

type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave";

function localDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayLocalKey(): string {
  return localDateKey(new Date());
}

function isScheduledRestDay(employee: Employee, target: Date): boolean {
  const period = getEmployeeWorkPeriod(employee, target);
  return period.kind === "OFF" || period.kind === "NOT_STARTED" || period.kind === "INVALID";
}

export default function ManagerDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<Array<{ employeeId: string; startDate: string; endDate: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const settings = getSettings();
  const today = todayLocalKey();
  const targetDate = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }, [today]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setSyncError(null);
      const errors: string[] = [];

      const [employeeResult, attendanceResult, leaveResult] = await Promise.allSettled([
        getBackendEmployees(),
        getBackendAttendance(2000),
        workforce.leaveRequests(),
      ]);

      if (!active) return;

      if (employeeResult.status === "fulfilled" && Array.isArray(employeeResult.value)) {
        setEmployees(employeeResult.value);
      } else {
        errors.push(`الموظفون: ${employeeResult.reason instanceof Error ? employeeResult.reason.message : "تعذر المزامنة مع D1"}`);
      }

      if (attendanceResult.status === "fulfilled" && Array.isArray(attendanceResult.value)) {
        // Attendance is the source of truth for the dashboard. Do not replace it
        // with an empty array when D1 is temporarily unavailable; that would turn
        // real present employees into false absences.
        setAttendance(attendanceResult.value);
        setLastSync(new Date());
      } else {
        errors.push(`الحضور: ${attendanceResult.reason instanceof Error ? attendanceResult.reason.message : "تعذر المزامنة مع D1"}`);
      }

      if (leaveResult.status === "fulfilled" && Array.isArray(leaveResult.value)) {
        setLeaveRequests(leaveResult.value);
      } else {
        errors.push(`الإجازات: ${leaveResult.reason instanceof Error ? leaveResult.reason.message : "تعذر الجلب"}`);
      }

      setSyncError(errors.length ? errors.join(" · ") : null);
      setLoading(false);
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter(employee => employee.status === "active"),
    [employees],
  );

  // Read actual attendance rows from D1 instead of the audit log. The audit log
  // is not the authoritative attendance table and can legitimately be incomplete.
  const todayAttendance = useMemo(() => {
    const byEmployee = new Map<string, AttendanceRecord>();
    for (const record of attendance) {
      if (record.type !== "check-in" || !record.employeeId || !record.timestamp) continue;
      if (localDateKey(record.timestamp) !== today) continue;
      const id = String(record.employeeId);
      const previous = byEmployee.get(id);
      if (!previous || Date.parse(record.timestamp) < Date.parse(previous.timestamp)) {
        byEmployee.set(id, record);
      }
    }
    return Array.from(byEmployee.values());
  }, [attendance, today]);

  const presentIds = useMemo(
    () => new Set(todayAttendance.map(record => String(record.employeeId)).filter(Boolean)),
    [todayAttendance],
  );

  const restIds = useMemo(
    () => new Set(
      activeEmployees
        .filter(employee => isScheduledRestDay(employee, targetDate))
        .map(employee => String(employee.id))
        .filter(Boolean),
    ),
    [activeEmployees, targetDate],
  );

  const leaveIds = useMemo(
    () => new Set(
      leaveRequests
        .filter(request =>
          String(request.status).toLowerCase() === "approved" &&
          request.startDate <= today &&
          request.endDate >= today,
        )
        .map(request => String(request.employeeId || ""))
        .filter(Boolean),
    ),
    [leaveRequests, today],
  );

  // If the attendance source is unavailable, absence cannot be proven.
  // Therefore no employee is marked absent while D1 attendance is unsynced.
  const attendanceSourceReady = !syncError || !syncError.includes("الحضور:");

  const pendingIds = useMemo(() => new Set(
    activeEmployees
      .filter(employee => {
        const id = String(employee.id);
        if (presentIds.has(id) || restIds.has(id) || leaveIds.has(id)) return false;
        const period = getEmployeeWorkPeriod(employee, targetDate);
        if (!period.isWorkDay || !period.start || !period.end) return false;
        return new Date().getTime() < period.end.getTime();
      })
      .map(employee => String(employee.id))
      .filter(Boolean),
  ), [activeEmployees, presentIds, restIds, leaveIds, targetDate]);

  const absentIds = useMemo(() => new Set(
    attendanceSourceReady
      ? activeEmployees
          .filter(employee => {
            const id = String(employee.id);
            return !presentIds.has(id) && !restIds.has(id) && !leaveIds.has(id) && !pendingIds.has(id);
          })
          .map(employee => String(employee.id))
          .filter(Boolean)
      : [],
  ), [attendanceSourceReady, activeEmployees, presentIds, restIds, leaveIds, pendingIds]);

  const lateIds = useMemo(() => new Set(
    todayAttendance
      .filter(record => {
        const employee = activeEmployees.find(item => String(item.id) === String(record.employeeId));
        if (!employee) return false;
        const period = getEmployeeWorkPeriod(employee, targetDate);
        const timestamp = Date.parse(String(record.timestamp || ""));
        if (!Number.isFinite(timestamp) || !period.start) return false;
        const grace = Math.max(0, employee.gracePeriodMinutes ?? settings?.lateGraceMinutes ?? 10);
        const late = Math.max(0, Math.round((timestamp - period.start.getTime()) / 60000) - grace);
        return late > 0;
      })
      .map(record => String(record.employeeId || ""))
      .filter(Boolean),
  ), [todayAttendance, activeEmployees, targetDate, settings?.lateGraceMinutes]);

  const absentCount = absentIds.size;

  const filteredEmployees = useMemo(
    () => activeEmployees.filter(employee => {
      const id = String(employee.id);
      if (search && !employee.name.includes(search)) return false;
      if (filter === "present" && !presentIds.has(id)) return false;
      if (filter === "absent" && !absentIds.has(id)) return false;
      if (filter === "late" && !lateIds.has(id)) return false;
      if (filter === "rest" && !restIds.has(id)) return false;
      if (filter === "leave" && !leaveIds.has(id)) return false;
      return true;
    }),
    [activeEmployees, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds],
  );

  const filters: Array<[Filter, string]> = [
    ["all", "الكل"],
    ["present", "الحاضرون"],
    ["absent", "الغائبون"],
    ["late", "المتأخرون"],
    ["rest", "المستريحون"],
    ["leave", "الإجازات"],
  ];

  return (
    <ManagerLayout
      title="لوحة القيادة"
      subtitle={`نظرة مباشرة على حالة الدوام اليوم · ${targetDate.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long" })}`}
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Kpi label="إجمالي الموظفين" value={activeEmployees.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب اليوم" value={absentCount} accent="warning" />
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
            <p className="text-xs text-muted-foreground mt-1">الحضور يُقرأ مباشرة من جدول Attendance في D1، وليس من سجل التدقيق.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4 text-primary" />}
            <span>{lastSync ? `آخر مزامنة ${lastSync.toLocaleTimeString("ar-EG")}` : "بانتظار مزامنة D1"}</span>
          </div>
        </div>

        {syncError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-5">
          <StatusCard label="حاضر" value={presentIds.size} tone="present" />
          <StatusCard label="غائب" value={absentCount} tone="absent" />
          <StatusCard label="متأخر" value={lateIds.size} tone="late" />
          <StatusCard label="راحة" value={restIds.size} tone="rest" />
          <StatusCard label="إجازة" value={leaveIds.size} tone="leave" />
        </div>
      </section>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold">حالة الموظفين اليوم</div>
            <div className="text-xs text-muted-foreground mt-1">المصدر: موظفو D1 + حضور D1 + جدول الدوام + الإجازات المعتمدة.</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {label}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الموظف" className="min-w-[180px] flex-1 rounded-lg border bg-secondary/50 px-3 py-1.5 text-sm" />
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">جاري مزامنة بيانات الحضور من D1…</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map(employee => {
              const id = String(employee.id);
              return <EmployeeRow key={employee.id} employee={employee} present={presentIds.has(id)} absent={absentIds.has(id)} rest={restIds.has(id)} leave={leaveIds.has(id)} late={lateIds.has(id)} pending={pendingIds.has(id)} />;
            })}
          </div>
        )}
      </section>
    </ManagerLayout>
  );
}

const EmployeeRow = memo(function EmployeeRow({ employee, present, absent, rest, leave, late, pending }: { employee: Employee; present: boolean; absent: boolean; rest: boolean; leave: boolean; late: boolean; pending: boolean }) {
  const status = present ? (late ? "متأخر" : "حاضر") : rest ? "مستريح" : leave ? "إجازة" : pending ? "بانتظار نهاية الدوام" : absent ? "غائب" : "غير محدد";
  const cls = present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : pending ? "border-border bg-secondary/30 text-muted-foreground" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cls}`}><span className="min-w-0 truncate font-semibold" title={employee.name}>{employee.name}</span><span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[11px] font-bold">{status}</span></div>;
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
