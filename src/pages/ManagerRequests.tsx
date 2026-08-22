import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendRequests, updateBackendRequest } from "@/lib/backend";

const typeLabel = (type: string) => type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : "انصراف";
const statusLabel = (status: string) => status === "pending" ? "قيد المراجعة" : status === "approved" ? "موافق عليه" : status === "rejected" ? "مرفوض" : status === "confirmed" ? "تم التأكيد" : status;

export default function ManagerRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async (initial = false) => {
    try {
      setError("");
      const rows = await getBackendRequests("admin");
      const next = Array.isArray(rows) ? rows : [];
      setRequests(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(false), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const pending = useMemo(() => requests.filter(r => r.status === "pending"), [requests]);
  const history = useMemo(() => requests.filter(r => r.status !== "pending"), [requests]);

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    try {
      await updateBackendRequest(id, status);
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث الطلب");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ManagerLayout
      title="طلبات الموظفين"
      subtitle="إجازات واستئذان وانصراف · تتم المزامنة مع الخادم تلقائيًا دون إعادة تحميل الواجهة."
      actions={<div className="flex items-center gap-2"><button onClick={() => void load(false)} className="btn-secondary text-xs">تحديث</button><Link to="/manager" className="btn-ghost text-xs">لوحة القيادة</Link></div>}
    >
      <section className="hud-card p-5 border-primary/25"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">طلبات بانتظار المراجعة</h2><p className="text-xs text-muted-foreground mt-1">تظهر الطلبات الجديدة هنا مباشرة دون مغادرة الهيكل الرئيسي.</p></div><span className="badge bg-primary/15 text-primary">{pending.length} بانتظار المراجعة</span></div></section>
      {error && <div className="hud-card p-4 text-sm border-destructive/30 mt-4"><b className="text-destructive">تعذر المزامنة:</b><span className="text-muted-foreground"> {error}</span></div>}
      {loading ? <div className="hud-card p-5 text-center mt-4">جاري تحميل الطلبات…</div> : <>
        {pending.length === 0 ? <div className="hud-card p-5 text-center text-sm text-muted-foreground mt-4">لا توجد طلبات بانتظار المراجعة.</div> : <section className="mt-4"><div className="text-sm font-bold mb-2">الطلبات الجديدة <span className="badge bg-destructive/15 text-destructive">{pending.length}</span></div><div className="space-y-3">{pending.map(r => <RequestCard key={r.id} request={r} busy={busy === r.id} review={review} />)}</div></section>}
        {history.length > 0 && <section className="pt-5"><div className="text-sm font-bold mb-2">السجل السابق</div><div className="space-y-2">{history.slice(0, 50).map(r => <HistoryCard key={r.id} request={r} />)}</div></section>}
      </>}
    </ManagerLayout>
  );
}

const HistoryCard = memo(function HistoryCard({ request }: { request: any }) {
  return <section className="hud-card p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-bold">{request.employeeName} · {request.jobNumber}</div><div className="text-xs text-muted-foreground mt-1">طلب {typeLabel(request.type)} · {request.reason || "بدون سبب"}</div></div><span className="badge">{statusLabel(request.status)}</span></div></section>;
});

const RequestCard = memo(function RequestCard({ request, busy, review }: { request: any; busy: boolean; review: (id: string, status: "approved" | "rejected") => Promise<void> }) {
  return <section className="hud-card p-4 border-primary/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-extrabold">{request.employeeName} <span className="text-muted-foreground font-normal">· {request.jobNumber}</span></div><div className="text-sm font-semibold text-primary mt-1">طلب {typeLabel(request.type)}</div><div className="text-xs text-muted-foreground mt-1">{request.reason || "بدون سبب"}</div><div className="text-[11px] text-muted-foreground mt-1">{new Date(request.createdAt).toLocaleString("ar-SA")}</div></div><div className="flex gap-2"><button disabled={busy} onClick={() => void review(request.id, "approved")} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold disabled:opacity-50">{busy ? "جاري…" : "موافقة"}</button><button disabled={busy} onClick={() => void review(request.id, "rejected")} className="rounded-xl border border-destructive/30 text-destructive px-4 py-2 text-xs font-bold disabled:opacity-50">رفض</button></div></div></section>;
});
