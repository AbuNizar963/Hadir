import { useMemo } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAttendance, getAudit, getEmployees, getSettings } from "@/lib/storage";
import { formatTime, todayKey } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function ManagerDashboard() {
  const employees = getEmployees();
  const settings = getSettings();
  const all = getAttendance();
  const audit = getAudit();
  const today = todayKey();

  const todayRec = useMemo(() => all.filter((r) => r.timestamp.startsWith(today)), [all, today]);
  const presentIds = new Set(todayRec.filter((r) => r.type === "check-in").map((r) => r.employeeId));
  const outIds = new Set(todayRec.filter((r) => r.type === "check-out").map((r) => r.employeeId));

  const [hh, mm] = settings.workStart.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(hh, mm, 0, 0);

  const lateList = todayRec
    .filter((r) => r.type === "check-in")
    .map((r) => {
      const late = Math.max(
        0,
        Math.round((new Date(r.timestamp).getTime() - scheduled.getTime()) / 60000) - settings.lateGraceMinutes
      );
      return { ...r, late };
    })
    .filter((r) => r.late > 0);

  const absentList = employees.filter((e) => e.status === "active" && !presentIds.has(e.id));
  const rejectedToday = audit.filter((a) => a.result === "rejected" && a.timestamp.startsWith(today));

  return (
    <ManagerLayout
      title="لوحة القيادة"
      subtitle={`نظرة مباشرة على دوام اليوم · ${new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long" })}`}
      actions={
        <div className="flex gap-2">
          <Link to="/manager/reports" className="btn-secondary text-xs">
            عرض التقارير
          </Link>
        </div>
      }
    >
      <div className="grid md:grid-cols-4 gap-4">
        <Kpi label="إجمالي الموظفين" value={employees.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب" value={absentList.length} accent="warning" />
        <Kpi label="محاولات مرفوضة اليوم" value={rejectedToday.length} accent="destructive" />
      </div>

      {/* باقي المحتوى كما هو */}
      {/* جدول الحضور، قائمة المتأخرين، المحاولات المرفوضة */}
      {/* ... */}
    </ManagerLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "warning" | "destructive" }) {
  const color =
    accent === "primary"
      ? "text-primary"
      : accent === "warning"
      ? "text-[hsl(var(--warning))]"
      : accent === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="hud-card p-5">
      <div className="text-xs text-muted-foreground mono">{label}</div>
      <div className={`text-3xl font-extrabold mono mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex justify-between items-baseline mb-3">
      <div className="text-sm font-bold">{title}</div>
      {hint && <div className="mono text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right font-semibold px-2 py-2">{children}</th>;
}
function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`px-2 py-2.5 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
