import { memo, useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendAudit, getBackendEmployees } from "@/lib/backend";
import { getEmployees, getSettings } from "@/lib/storage";
import { todayKey } from "@/lib/utils";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import type { Employee } from "@/types";

type Filter = "all" | "present" | "absent" | "late" | "rest";
type AttendanceAudit = { employeeId?: string; action?: string; result?: string; timestamp?: string };

function scheduleTypeOf(employee: Employee): "ADMIN" | "ROTATION" {
  return String(employee.scheduleType || "ADMIN").trim().toUpperCase() === "ROTATION" ? "ROTATION" : "ADMIN";
}

function isScheduledRestDay(employee: Employee, target: Date): boolean {
  const scheduleType = scheduleTypeOf(employee);

  // Administrative schedules are driven by their explicit weekly work days.
  // Never infer absence before checking this source of truth.
  if (scheduleType === "ADMIN") {
    const workDays = Array.isArray(employee.workDays)
      ? [...new Set(employee.workDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [0, 1, 2, 3, 4];
    return !workDays.includes(target.getDay());
  }

  // Rotation schedules are driven by the employee's own cycle. Only an
  // explicit OFF period is a rest day; malformed schedules stay unclassified
  // rather than being silently converted into absence.
  return getEmployeeWorkPeriod(employee, target).kind === "OFF";
}

export default function ManagerDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const settings = getSettings();
  const today = todayKey();
  const now = new Date();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [employeeResult, attendanceResult] = await Promise.allSettled([
        getBackendEmployees(),
        getBackendAudit(2000),
      ]);
      if (!active) return;
      setEmployees(employeeResult.status === "fulfilled" ? employeeResult.value : getEmployees());
      setAttendance(attendanceResult.status === "fulfilled" ? attendanceResult.value : []);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const todayRecords = useMemo(() => attendance.filter(r => r.timestamp?.startsWith(today) && r.action === "check-in" && r.result === "success"), [attendance, today]);
  const presentIds = useMemo(() => new Set(todayRecords.map(r => String(r.employeeId || "")).filter(Boolean)), [todayRecords]);
  const [hh, mm] = (settings?.workStart || "08:00").split(":").map(Number);
  const scheduled = useMemo(() => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; }, [hh, mm]);
  const lateIds = useMemo(() => new Set(todayRecords.filter(r => { const timestamp = Date.parse(String(r.timestamp || "")); if (!Number.isFinite(timestamp)) return false; const late = Math.max(0, Math.round((timestamp - scheduled.getTime()) / 60000) - (settings?.lateGraceMinutes ?? 10)); return late > 0; }).map(r => String(r.employeeId || "")).filter(Boolean)), [todayRecords, scheduled, settings?.lateGraceMinutes]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === "active"), [employees]);

  // Attendance classification order is deliberate:
  // 1) present, 2) scheduled rest, 3) absent. A rest day can never become absent.
  const restIds = useMemo(() => new Set(
    activeEmployees
      .filter(employee => isScheduledRestDay(employee, now))
      .map(employee => String(employee.id))
      .filter(Boolean),
  ), [activeEmployees, today]);

  const absentIds = useMemo(() => new Set(
    activeEmployees
      .filter(employee => !presentIds.has(String(employee.id)) && !restIds.has(String(employee.id)))
      .map(employee => String(employee.id))
      .filter(Boolean),
  ), [activeEmployees, presentIds, restIds]);
  const absentCount = absentIds.size;

  const filteredEmployees = useMemo(() => activeEmployees.filter(e => {
    const id = String(e.id);
    if (search && !e.name.includes(search)) return false;
    if (filter === "present" && !presentIds.has(id)) return false;
    if (filter === "absent" && !absentIds.has(id)) return false;
    if (filter === "late" && !lateIds.has(id)) return false;
    if (filter === "rest" && !restIds.has(id)) return false;
    return true;
  }), [activeEmployees, search, filter, presentIds, absentIds, lateIds, restIds]);

  return (
    <ManagerLayout
      title="لوحة القيادة"
      subtitle={`نظرة مباشرة على حالة الدوام اليوم · ${new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long" })}`}
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5 mb-6">
        <Kpi label="إجمالي الموظفين" value={activeEmployees.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب اليوم" value={absentCount} accent="warning" />
        <Kpi label="مستريحون" value={restIds.size} accent="rest" />
        <Kpi label="متأخرون" value={lateIds.size} accent="destructive" />
      </section>

      <section className="hud-card p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h2 className="text-lg font-extrabold">ملخص اليوم</h2><p className="text-xs text-muted-foreground mt-1">الموظف في يوم راحة أو إجازة مجدولة لا يُحتسب غائباً.</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <StatusCard label="حاضر" value={presentIds.size} tone="present" />
          <StatusCard label="غائب" value={absentCount} tone="absent" />
          <StatusCard label="مستريح" value={restIds.size} tone="rest" />
          <StatusCard label="متأخر" value={lateIds.size} tone="late" />
        </div>
      </section>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><div className="text-sm font-bold">حالة الموظفين اليوم</div><div className="text-xs text-muted-foreground mt-1">للمتابعة السريعة؛ التفاصيل والسجل الكامل في «الموظفون» و«التقارير».</div></div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "present", "absent", "rest", "late"].map(v => <button key={v} onClick={() => setFilter(v as Filter)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{v === "all" ? "الكل" : v === "present" ? "الحاضرون" : v === "absent" ? "الغائبون" : v === "rest" ? "المستريحون" : "المتأخرون"}</button>)}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الموظف" className="min-w-[180px] flex-1 rounded-lg border bg-secondary/50 px-3 py-1.5 text-sm" />
        </div>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">جاري مزامنة بيانات الحضور…</div> : filteredEmployees.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredEmployees.map(e => {
          const id = String(e.id);
          return <EmployeeRow key={e.id} employee={e} present={presentIds.has(id)} absent={absentIds.has(id)} rest={restIds.has(id)} late={lateIds.has(id)} />;
        })}</div>}
      </section>
    </ManagerLayout>
  );
}

const EmployeeRow = memo(function EmployeeRow({ employee, present, absent, rest, late }: { employee: Employee; present: boolean; absent: boolean; rest: boolean; late: boolean }) {
  const status = rest ? "مستريح" : present ? (late ? "متأخر" : "حاضر") : absent ? "غائب" : "غير محدد";
  const cls = rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cls}`}><span className="min-w-0 truncate font-semibold" title={employee.name}>{employee.name}</span><span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[11px] font-bold">{status}</span></div>;
});

const Kpi = memo(function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "warning" | "destructive" | "rest" }) {
  const color = accent === "primary" ? "text-primary" : accent === "warning" ? "text-[hsl(var(--warning))]" : accent === "destructive" ? "text-destructive" : accent === "rest" ? "text-sky-600 dark:text-sky-300" : "text-foreground";
  return <div className="hud-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-3xl font-extrabold mono ${color}`}>{value}</div></div>;
});

function StatusCard({ label, value, tone }: { label: string; value: number; tone: "present" | "absent" | "late" | "rest" }) {
  const style = tone === "present" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : tone === "absent" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return <div className={`rounded-xl border p-4 ${style}`}><div className="text-xs font-bold">{label}</div><div className="mt-1 text-2xl font-black mono">{value}</div></div>;
}
