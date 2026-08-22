import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendAttendance, getBackendEmployees, getBackendRequests, updateBackendRequest } from "@/lib/backend";
import { getAttendance, getEmployees, getSettings } from "@/lib/storage";
import { todayKey } from "@/lib/utils";
import type { AttendanceRecord, Employee, EmployeeRequest } from "@/types";
import { Link } from "react-router-dom";

export default function ManagerDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const settings = getSettings();
  const today = todayKey();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [employeeResult, attendanceResult, requestResult] = await Promise.allSettled([
        getBackendEmployees(),
        getBackendAttendance(2000),
        getBackendRequests("admin"),
      ]);
      if (!active) return;
      if (employeeResult.status === "fulfilled") setEmployees(employeeResult.value); else setEmployees(getEmployees());
      if (attendanceResult.status === "fulfilled") setAttendance(attendanceResult.value); else setAttendance(getAttendance());
      if (requestResult.status === "fulfilled") setRequests(requestResult.value);
      setLoadingRequests(false);
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [search, setSearch] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const todayRec = useMemo(() => attendance.filter((r) => r.timestamp.startsWith(today)), [attendance, today]);
  const presentIds = new Set(todayRec.filter((r) => r.type === "check-in").map((r) => r.employeeId));
  const [hh, mm] = (settings?.workStart || "08:00").split(":").map(Number);
  const scheduled = new Date(); scheduled.setHours(hh, mm, 0, 0);
  const lateList = todayRec.filter((r) => r.type === "check-in").map((r) => ({ ...r, late: Math.max(0, Math.round((new Date(r.timestamp).getTime() - scheduled.getTime()) / 60000) - (settings?.lateGraceMinutes ?? 10)) })).filter((r) => r.late > 0);
  const absentList = employees.filter((e) => e.status === "active" && !presentIds.has(e.id));
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const todayRequests = requests.filter((r) => r.createdAt?.startsWith(today));
  const filteredEmployees = employees.filter((e) => {
    if (search && !e.name.includes(search)) return false;
    if (filter === "present" && !presentIds.has(e.id)) return false;
    if (filter === "absent" && presentIds.has(e.id)) return false;
    if (filter === "late" && !lateList.find((r) => r.employeeId === e.id)) return false;
    return true;
  });
  const requestType = (type: string) => type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : "انصراف";
  const decideRequest = async (request: EmployeeRequest, status: "approved" | "rejected") => {
    setRequestBusy(request.id);
    try { await updateBackendRequest(request.id, status); setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item)); }
    catch (error) { alert(error instanceof Error ? error.message : "تعذر تحديث الطلب."); }
    finally { setRequestBusy(null); }
  };

  return <ManagerLayout title="لوحة القيادة" subtitle={`نظرة مباشرة على دوام اليوم · ${new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long" })}`} actions={<div className="flex gap-2"><Link to="/manager/reports" className="btn-secondary text-xs">عرض التقارير</Link><div className="relative"><button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="btn-secondary text-xs">⬇️ تصدير البيانات</button>{exportMenuOpen && <div className="absolute mt-1 right-0 w-32 bg-card border border-border rounded-lg shadow-lg z-50"><button onClick={() => { setExportMenuOpen(false); alert("تم اختيار PDF (مثال)"); }} className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary">📄 PDF</button><button onClick={() => { setExportMenuOpen(false); alert("تم اختيار CSV (مثال)"); }} className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary">📊 CSV</button></div>}</div></div>}>
    <div className="grid md:grid-cols-4 gap-4 mb-6"><Kpi label="إجمالي الموظفين" value={employees.length} /><Kpi label="حضور اليوم" value={presentIds.size} accent="primary" /><Kpi label="غياب" value={absentList.length} accent="warning" /><Kpi label="طلبات بانتظار المراجعة" value={pendingRequests.length} accent="destructive" /></div>
    <div className="hud-card p-5 mb-6 border-primary/20">
      <div className="flex items-center justify-between gap-3 mb-4"><div><SectionTitle title="إدارة الطلبات" hint={`${todayRequests.length} اليوم · ${pendingRequests.length} بانتظار المراجعة`} /><p className="text-xs text-muted-foreground -mt-1">طلبات الإجازة والاستئذان والانصراف تظهر هنا فور وصولها.</p></div><Link to="/manager/requests" className="text-xs font-bold text-primary">عرض كل الطلبات ←</Link></div>
      {loadingRequests ? <p className="text-sm text-muted-foreground">جاري تحميل الطلبات...</p> : pendingRequests.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات جديدة بانتظار المراجعة.</p> : <div className="space-y-3">{pendingRequests.slice(0, 20).map((request) => <div key={request.id} className="rounded-xl border border-border/70 bg-background/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{request.employeeName} · {requestType(request.type)}</div><div className="mt-1 text-xs text-muted-foreground">{request.reason || "بدون ملاحظة"}</div><div className="mt-1 text-[11px] text-muted-foreground">{new Date(request.createdAt).toLocaleString("ar-SA")}</div></div><div className="flex gap-2"><button disabled={requestBusy === request.id} onClick={() => void decideRequest(request, "approved")} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50">✓ موافقة</button><button disabled={requestBusy === request.id} onClick={() => void decideRequest(request, "rejected")} className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50">✕ رفض</button></div></div></div>)}</div>}
    </div>
    <div className="flex gap-2 mb-4"><select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border px-2 py-1.5 rounded-lg text-sm bg-secondary/50"><option value="all">الكل</option><option value="present">الحاضرون</option><option value="absent">الغائبون</option><option value="late">المتأخرون</option></select><input type="text" placeholder="🔍 بحث بالاسم" value={search} onChange={(e) => setSearch(e.target.value)} className="border px-3 py-1.5 rounded-lg text-sm bg-secondary/50 flex-1" /></div>
    <div className="hud-card p-5"><SectionTitle title="قائمة الموظفين" hint={`عدد: ${filteredEmployees.length}`} /><ul className="space-y-2">{filteredEmployees.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج مطابقة</p> : filteredEmployees.map((e) => <li key={e.id} className="flex justify-between items-center border-b border-border/50 pb-2"><span className="font-medium">{e.name}</span><span className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground">{e.role}</span></li>)}</ul></div>
  </ManagerLayout>;
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "warning" | "destructive" }) { const color = accent === "primary" ? "text-primary" : accent === "warning" ? "text-[hsl(var(--warning))]" : accent === "destructive" ? "text-destructive" : "text-foreground"; return <div className="hud-card p-5"><div className="text-xs text-muted-foreground mono">{label}</div><div className={`text-3xl font-extrabold mono mt-1 ${color}`}>{value}</div></div>; }
function SectionTitle({ title, hint }: { title: string; hint?: string }) { return <div className="flex justify-between items-baseline mb-3"><div className="text-sm font-bold">{title}</div>{hint && <div className="mono text-xs text-muted-foreground">{hint}</div>}</div>; }
