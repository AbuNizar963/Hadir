import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getBackendAttendance, getBackendRequests } from "@/lib/backend";

export default function EmployeeHistory() {
  const nav = useNavigate();
  const session = currentSession();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) { nav("/login", { replace: true }); return; }
    let alive = true;
    (async () => {
      try {
        const [a, r] = await Promise.all([getBackendAttendance(1000), getBackendRequests()]);
        if (!alive) return;
        setAttendance(a.filter((x: any) => x.employeeId === session.employeeId));
        setRequests(r.filter((x: any) => x.employeeId === session.employeeId));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "تعذر تحميل السجل");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session, nav]);

  const rows = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of attendance) {
      const day = String(a.timestamp).slice(0, 10);
      const row = map.get(day) || { day, checkIn: null, checkOut: null };
      if (a.type === "check-in" || a.type === "in") row.checkIn = a.timestamp;
      if (a.type === "check-out" || a.type === "out") row.checkOut = a.timestamp;
      map.set(day, row);
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [attendance]);

  return <div className="min-h-screen"><header className="max-w-xl mx-auto px-4 py-5 flex items-center justify-between"><Brand /><Link className="btn-ghost text-xs" to="/employee">العودة</Link></header><main className="max-w-xl mx-auto px-4 pb-12 space-y-4"><section className="hud-card p-5"><h1 className="text-xl font-extrabold">سجل عملي</h1><p className="text-xs text-muted-foreground mt-1">أوقات حضورك وانصرافك وطلبات الإذن والإجازة محفوظة مركزيًا.</p></section>{loading&&<section className="hud-card p-5 text-center text-sm">جاري تحميل السجل…</section>}{error&&<section className="hud-card p-5 text-sm text-destructive">{error}</section>} {!loading&&!error&&<><section className="hud-card p-4"><h2 className="font-bold mb-3">الحضور والانصراف</h2><div className="space-y-2">{rows.length===0?<p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p>:rows.map((r)=><div key={r.day} className="rounded-xl border border-border p-3 grid grid-cols-3 gap-2 text-xs"><span>{r.day}</span><span>حضور: {r.checkIn?new Date(r.checkIn).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}):"—"}</span><span>انصراف: {r.checkOut?new Date(r.checkOut).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}):"—"}</span></div>)}</div></section><section className="hud-card p-4"><h2 className="font-bold mb-3">طلبات الإذن والإجازة</h2><div className="space-y-2">{requests.length===0?<p className="text-sm text-muted-foreground">لا توجد طلبات.</p>:requests.map((r)=><div key={r.id} className="rounded-xl border border-border p-3 flex items-center justify-between gap-3 text-xs"><div><div className="font-bold">{r.type === "permission" ? "استئذان" : r.type === "leave" ? "إجازة" : "انصراف"}</div><div className="text-muted-foreground mt-1">{r.reason || "بدون سبب"}</div></div><span className="badge">{r.status === "approved" ? "موافق عليه" : r.status === "rejected" ? "مرفوض" : r.status === "confirmed" ? "تم التأكيد" : "قيد المراجعة"}</span></div>)}</div></section></>}</main></div>;
}
