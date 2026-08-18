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
        <Link to="/manager/reports" className="btn-secondary text-xs">
          عرض التقارير
        </Link>
      }
    >
      <div className="grid md:grid-cols-4 gap-4">
        <Kpi label="إجمالي الموظفين" value={employees.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب" value={absentList.length} accent="warning" />
        <Kpi label="محاولات مرفوضة اليوم" value={rejectedToday.length} accent="destructive" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <section className="hud-card p-5 lg:col-span-2">
          <SectionTitle title="الحضور المباشر" hint={`${todayRec.filter((r) => r.type === "check-in").length} عملية دخول`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <Th>الموظف</Th>
                  <Th>الرقم</Th>
                  <Th>الحضور</Th>
                  <Th>الانصراف</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const inRec = todayRec.find((r) => r.employeeId === e.id && r.type === "check-in");
                  const outRec = todayRec.find((r) => r.employeeId === e.id && r.type === "check-out");
                  const late = lateList.find((l) => l.employeeId === e.id);
                  return (
                    <tr key={e.id} className="border-t border-border/50">
                      <Td className="font-semibold">{e.name}</Td>
                      <Td className="mono">{e.jobNumber}</Td>
                      <Td className="mono">{inRec ? formatTime(inRec.timestamp) : "—"}</Td>
                      <Td className="mono">{outRec ? formatTime(outRec.timestamp) : "—"}</Td>
                      <Td>
                        {!inRec ? (
                          <span className="badge bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">غائب</span>
                        ) : late ? (
                          <span className="badge bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">متأخر {late.late} د</span>
                        ) : outRec ? (
                          <span className="badge bg-accent/15 text-accent">منصرف</span>
                        ) : (
                          <span className="badge bg-primary/15 text-primary">حاضر</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr>
                    <Td className="text-center text-muted-foreground py-6" colSpan={5}>
                      لا يوجد موظفون بعد. أضف من صفحة الموظفين.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hud-card p-5">
          <SectionTitle title="المتأخرون اليوم" hint={`${lateList.length}`} />
          <ul className="space-y-2">
            {lateList.map((l) => (
              <li key={l.id} className="rounded-xl bg-secondary/40 border border-border/50 p-3 flex justify-between">
                <div>
                  <div className="font-semibold">{l.employeeName}</div>
                  <div className="text-xs text-muted-foreground mono">{l.jobNumber}</div>
                </div>
                <div className="text-left">
                  <div className="mono text-sm">{formatTime(l.timestamp)}</div>
                  <div className="text-xs text-[hsl(var(--warning))]">تأخر {l.late} د</div>
                </div>
              </li>
            ))}
            {lateList.length === 0 && (
              <li className="text-center text-xs text-muted-foreground py-4">لا يوجد متأخرون.</li>
            )}
          </ul>

          <div className="border-t border-border/60 mt-5 pt-4">
            <SectionTitle title="آخر المحاولات المرفوضة" hint={`${rejectedToday.length}`} />
            <ul className="space-y-2">
              {rejectedToday.slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-xl bg-destructive/5 border border-destructive/30 p-3">
                  <div className="flex justify-between">
                    <div className="font-semibold text-sm">{a.actorName}</div>
                    <div className="mono text-xs text-muted-foreground">{formatTime(a.timestamp)}</div>
                  </div>
                  <div className="text-xs text-destructive/90 mt-1">{a.reason}</div>
                </li>
              ))}
              {rejectedToday.length === 0 && (
                <li className="text-center text-xs text-muted-foreground py-4">لا يوجد محاولات مرفوضة اليوم.</li>
              )}
            </ul>
          </div>
        </section>
      </div>
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
