import { memo, useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendAudit, getBackendEmployees } from "@/lib/backend";
import { getEmployees, getSettings } from "@/lib/storage";
import { workforce } from "@/lib/workforce";
import { todayKey } from "@/lib/utils";
import { getEmployeeWorkPeriod } from "@/lib/schedule";
import type { Employee } from "@/types";

type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave";
type AttendanceAudit = { employeeId?: string; action?: string; result?: string; timestamp?: string };

function scheduleTypeOf(employee: Employee): "ADMIN" | "ROTATION" {
  return String(employee.scheduleType || "ADMIN").trim().toUpperCase() === "ROTATION" ? "ROTATION" : "ADMIN";
}

function isScheduledRestDay(employee: Employee, target: Date): boolean {
  const scheduleType = scheduleTypeOf(employee);
  if (scheduleType === "ADMIN") {
    const workDays = Array.isArray(employee.workDays)
      ? [...new Set(employee.workDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [0, 1, 2, 3, 4];
    return !workDays.includes(target.getDay());
  }
  return getEmployeeWorkPeriod(employee, target).kind === "OFF";
}

export default function ManagerDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceAudit[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<Array<{ employeeId: string; startDate: string; endDate: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const settings = getSettings();
  const today = todayKey();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [employeeResult, attendanceResult, leaveResult] = await Promise.allSettled([
        getBackendEmployees(),
        getBackendAudit(2000),
        workforce.leaveRequests(),
      ]);
      if (!active) return;
      setEmployees(employeeResult.status === "fulfilled" ? employeeResult.value : getEmployees());
      setAttendance(attendanceResult.status === "fulfilled" ? attendanceResult.value : []);
      setLeaveRequests(leaveResult.status === "fulfilled" ? leaveResult.value : []);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const todayRecords = useMemo(
    () => attendance.filter(r => r.timestamp?.startsWith(today) && r.action === "check-in" && r.result === "success"),
    [attendance, today],
  );
  const presentIds = useMemo(
    () => new Set(todayRecords.map(r => String(r.employeeId || "")).filter(Boolean)),
    [todayRecords],
  );
  const [hh, mm] = (settings?.workStart || "08:00").split(":").map(Number);
  const scheduled = useMemo(() => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; }, [hh, mm]);
  const lateIds = useMemo(() => new Set(todayRecords.filter(r => {
    const timestamp = Date.parse(String(r.timestamp || ""));
    if (!Number.isFinite(timestamp)) return false;
    const late = Math.max(0, Math.round((timestamp - scheduled.getTime()) / 60000) - (settings?.lateGraceMinutes ?? 10));
    return late > 0;
  }).map(r => String(r.employeeId || "")).filter(Boolean)), [todayRecords, scheduled, settings?.lateGraceMinutes]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === "active"), [employees]);
  const targetDate = useMemo(() => new Date(`${today}T12:00:00`), [today]);

  const restIds = useMemo(() => new Set(
    activeEmployees
      .filter(employee => isScheduledRestDay(employee, targetDate))
      .map(employee => String(employee.id))
      .filter(Boolean),
  ), [activeEmployees, targetDate]);

  // Only an approved leave request whose date range contains today is a leave day.
  // Leave is classified after present/rest so an actual check-in always remains authoritative.
  const leaveIds = useMemo(() => new Set(
    leaveRequests
      .filter(request => request.status === "approved" && request.startDate <= today && request.endDate >= today)
      .map(request => String(request.employeeId || ""))
      .filter(Boolean),
  ), [leaveRequests, today]);

  const absentIds = useMemo(() => new Set(
    activeEmployees
      .filter(employee => {
        const id = String(employee.id);
        return !presentIds.has(id) && !restIds.has(id) && !leaveIds.has(id);
      })
      .map(employee => String(employee.id))
      .filter(Boolean),
  ), [activeEmployees, presentIds, restIds, leaveIds]);
  const absentCount = absentIds.size;

  const filteredEmployees = useMemo(() => activeEmployees.filter(e => {
    const id = String(e.id);
    if (search && !e.name.includes(search)) return false;
    if (filter === "present" && !presentIds.has(id)) return false;
    if (filter === "absent" && !absentIds.has(id)) return false;
    if (filter === "late" && !lateIds.has(id)) return false;
    if (filter === "rest" && !restIds.has(id)) return false;
    if (filter === "leave" && !leaveIds.has(id)) return false;
    return true;
  }), [activeEmployees, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds]);

  const filters: Array<[Filter, string]> = [
    ["all", "الكل"], ["present", "الحاضرون"], ["absent", "الغائبون"],
    ["late", "المتأخرون"], ["rest", "المستريحون"], ["leave", "الإجازات"],
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
        <Kpi label="الراحة" value={restIds.size} accent="rest" />
        <Kpi label="الإجازات" value={leaveIds.size} accent="leave" />
      </section>

      <section className="hud-card p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h2 className="text-lg font-extrabold">ملخص اليوم</h2><p className="text-xs text-muted-foreground mt-1">الموظف في يوم راحة أو إجازة معتمدة لا يُحتسب غائباً.</p></div>
        </div>
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
          <div><div className="text-sm font-bold">حالة الموظفين اليوم</div><div className="text-xs text-muted-foreground mt-1">المصدر: سجل الحضور + جدول الدوام + الإجازات المعتمدة.</div></div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{label}</button>)}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الموظف" className="min-w-[180px] flex-1 rounded-lg border bg-secondary/50 px-3 py-1.5 text-sm" />
        </div>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">جاري مزامنة بيانات الحضور…</div> : filteredEmployees.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredEmployees.map(e => {
          const id = String(e.id);
          return <EmployeeRow key={e.id} employee={e} present={presentIds.has(id)} absent={absentIds.has(id)} rest={restIds.has(id)} leave={leaveIds.has(id)} late={lateIds.has(id)} />;
        })}</div>}
      </section>
    </ManagerLayout>
  );
}

const EmployeeRow = memo(function EmployeeRow({ employee, present, absent, rest, leave, late }: { employee: Employee; present: boolean; absent: boolean; rest: boolean; leave: boolean; late: boolean }) {
  const status = present ? (late ? "متأخر" : "حاضر") : rest ? "مستريح" : leave ? "إجازة" : absent ? "غائب" : "غير محدد";
  const cls = present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${cls}`}><span className="min-w-0 truncate font-semibold" title={employee.name}>{employee.name}</span><span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[11px] font-bold">{status}</span></div>;
});

const Kpi = memo(function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "warning" | "destructive" | "rest" | "leave" }) {
  const color = accent === "primary" ? "text-primary" : accent === "warning" ? "text-[hsl(var(--warning))]" : accent === "destructive" ? "text-destructive" : accent === "rest" ? "text-sky-600 dark:text-sky-300" : accent === "leave" ? "text-violet-600 dark:text-violet-300" : "text-foreground";
  return <div className="hud-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-3xl font-extrabold mono ${color}`}>{value}</div></div>;
});

function StatusCard({ label, value, tone }: { label: string; value: number; tone: "present" | "absent" | "late" | "rest" | "leave" }) {
  const style = tone === "present" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : tone === "absent" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : tone === "leave" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return <div className={`rounded-xl border p-4 ${style}`}><div className="text-xs font-bold">{label}</div><div className="mt-1 text-2xl font-black mono">{value}</div></div>;
}
