import { useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAttendance, getAudit, getEmployees, getSettings } from "@/lib/storage";
import { todayKey } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";

export default function ManagerDashboard() {
  const employees = getEmployees();
  const settings = getSettings();
  const all = getAttendance();
  const audit = getAudit();
  const today = todayKey();

  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [search, setSearch] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const todayRec = useMemo(() => all.filter((r) => r.timestamp.startsWith(today)), [all, today]);
  const presentIds = new Set(todayRec.filter((r) => r.type === "check-in").map((r) => r.employeeId));

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

  const filteredEmployees = employees.filter((e) => {
    if (search && !e.name.includes(search)) return false;
    if (filter === "present" && !presentIds.has(e.id)) return false;
    if (filter === "absent" && presentIds.has(e.id)) return false;
    if (filter === "late" && !lateList.find((r) => r.employeeId === e.id)) return false;
    return true;
  });

  const chartData = {
    labels: ["حضور", "غياب", "مرفوض"],
    datasets: [
      {
        label: "إحصائيات اليوم",
        data: [presentIds.size, absentList.length, rejectedToday.length],
        backgroundColor: ["#4ade80", "#facc15", "#f87171"],
      },
    ],
  };

  return (
    <ManagerLayout
      title="لوحة القيادة"
      subtitle={`نظرة مباشرة على دوام اليوم · ${new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long" })}`}
      actions={
        <div className="flex gap-2">
          <Link to="/manager/reports" className="btn-secondary text-xs">
            عرض التقارير
          </Link>

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="btn-secondary text-xs"
            >
              ⬇️ تصدير البيانات
            </button>

            {exportMenuOpen && (
              <div className="absolute mt-1 right-0 w-32 bg-card border border-border rounded-lg shadow-lg">
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    alert("تم اختيار PDF (مثال)");
                  }}
                  className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary"
                >
                  📄 PDF
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    alert("تم اختيار CSV (مثال)");
                  }}
                  className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary"
                >
                  📊 CSV
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Kpi label="إجمالي الموظفين" value={employees.length} />
        <Kpi label="حضور اليوم" value={presentIds.size} accent="primary" />
        <Kpi label="غياب" value={absentList.length} accent="warning" />
        <Kpi label="محاولات مرفوضة اليوم" value={rejectedToday.length} accent="destructive" />
      </div>

      <div className="hud-card p-5 mb-6">
        <Bar data={chartData} />
      </div>

      <div className="flex gap-2 mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="btn-secondary text-xs">
          <option value="all">الكل</option>
          <option value="present">الحاضرون</option>
          <option value="absent">الغائبون</option>
          <option value="late">المتأخرون</option>
        </select>
        <input
          type="text"
          placeholder="🔍 بحث بالاسم"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 rounded-lg text-sm"
        />
      </div>

      <div className="hud-card p-5">
        <SectionTitle title="قائمة الموظفين" hint={`عدد: ${filteredEmployees.length}`} />
        <ul className="space-y-2">
          {filteredEmployees.map((e) => (
            <li key={e.id} className="flex justify-between border-b pb-1">
              <span>{e.name}</span>
              <span className="text-xs text-muted-foreground">{e.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hud-card p-5 mt-6">
        <SectionTitle title="إدارة الطلبات" hint="إجازات واستئذان" />
        <p className="text-sm text-muted-foreground">لا توجد طلبات جديدة اليوم.</p>
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
