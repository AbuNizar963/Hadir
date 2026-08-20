import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "@/components/Brand";
import { getBackendRequests, updateBackendRequest } from "@/lib/backend";
import { currentManagerSession } from "@/lib/auth";

export default function ManagerRequests() {
  const session = currentManagerSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try { setError(""); setRequests(await getBackendRequests()); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الطلبات"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    try { await updateBackendRequest(id, status); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث الطلب"); }
    finally { setBusy(null); }
  };

  return <div className="min-h-screen"><header className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between"><Brand /><Link to="/manager" className="btn-ghost text-xs">العودة للوحة التحكم</Link></header><main className="max-w-4xl mx-auto px-4 pb-12 space-y-4"><section className="hud-card p-5"><h1 className="text-xl font-extrabold">طلبات الموظفين</h1><p className="text-xs text-muted-foreground mt-1">راجع طلبات الإذن والإجازة والانصراف قبل السماح للموظف بتأكيدها.</p></section>{error&&<div className="hud-card p-4 text-sm text-destructive">{error}</div>}{loading?<div className="hud-card p-5 text-center">جاري تحميل الطلبات…</div>:<div className="space-y-3">{requests.length===0?<div className="hud-card p-5 text-center text-sm text-muted-foreground">لا توجد طلبات.</div>:requests.map((r)=><section key={r.id} className="hud-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-bold">{r.employeeName} · {r.jobNumber}</div><div className="text-xs text-muted-foreground mt-1">{r.type === "permission" ? "استئذان" : r.type === "leave" ? "إجازة" : "انصراف"} · {r.reason || "بدون سبب"}</div></div><span className="badge">{r.status === "pending" ? "قيد المراجعة" : r.status === "approved" ? "موافق عليه" : r.status === "rejected" ? "مرفوض" : r.status}</span></div>{r.status === "pending" && <div className="flex gap-2 mt-4"><button disabled={busy===r.id} onClick={()=>void review(r.id,"approved")} className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 font-bold text-sm">{busy===r.id?"جاري…":"موافقة"}</button><button disabled={busy===r.id} onClick={()=>void review(r.id,"rejected")} className="flex-1 rounded-xl border border-border py-2 font-bold text-sm">رفض</button></div>}</section>)}</div>}</main></div>;
}
