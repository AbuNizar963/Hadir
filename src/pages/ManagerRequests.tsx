import { memo, useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getBackendRequests, updateBackendRequest } from "@/lib/backend";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const typeLabel = (type: string) => type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : type === "device-rebind" ? "فك ربط الهاتف" : "انصراف";
const statusLabel = (status: string) => status === "pending" ? "قيد المراجعة" : status === "approved" ? "موافق عليه" : status === "rejected" ? "مرفوض" : status === "confirmed" ? "تم التأكيد" : status;

async function getDeviceRebindRequests() {
  const token = localStorage.getItem("hadir.api.token.admin") || "";
  const response = await fetch(`${API_URL}/api/device-rebind-requests`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(String((data as any)?.error || "تعذر تحميل طلبات فك ربط الهاتف"));
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: String(row.id),
    type: "device-rebind",
    employeeName: String(row.employee_name ?? row.employeeName ?? ""),
    jobNumber: String(row.job_number ?? row.jobNumber ?? ""),
    reason: row.reason || "يريد الموظف إعادة ربط حسابه بهاتف جديد",
    deviceLabel: row.device_label ?? row.deviceLabel ?? null,
    deviceId: row.device_id ?? row.deviceId ?? null,
    status: String(row.status || "pending"),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  }));
}

async function reviewDeviceRebind(id: string, status: "approved" | "rejected") {
  const token = localStorage.getItem("hadir.api.token.admin") || "";
  const response = await fetch(`${API_URL}/api/device-rebind-requests`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ id, status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as any)?.error || "تعذر تحديث طلب فك ربط الهاتف"));
}

export default function ManagerRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async (initial = false) => {
    try {
      setError("");
      const [legacyRows, rebindRows] = await Promise.all([
        getBackendRequests("admin"),
        getDeviceRebindRequests(),
      ]);
      const next = [...(Array.isArray(legacyRows) ? legacyRows : []), ...rebindRows];
      next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void load(false);
      }, 250);
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void load(false); };
    window.addEventListener("hadir:cloud-data-changed", scheduleRefresh);
    window.addEventListener("hadir:d1-view-changed", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("hadir:cloud-data-changed", scheduleRefresh);
      window.removeEventListener("hadir:d1-view-changed", scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const pending = useMemo(() => requests.filter(r => r.status === "pending"), [requests]);
  const history = useMemo(() => requests.filter(r => r.status !== "pending"), [requests]);

  const review = async (id: string, status: "approved" | "rejected", type?: string) => {
    setBusy(id);
    try {
      if (type === "device-rebind") await reviewDeviceRebind(id, status);
      else await updateBackendRequest(id, status);
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
      subtitle="إجازات واستئذان وانصراف وطلبات فك ربط الهاتف · تتم المزامنة مع الخادم تلقائيًا."
      actions={<button onClick={() => void load(false)} className="btn-secondary text-xs">تحديث</button>}
    >
      <section className="hud-card p-5 border-primary/25"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">طلبات بانتظار المراجعة</h2><p className="text-xs text-muted-foreground mt-1">طلبات فك ربط الهاتف التي يرسلها الموظف من شاشة تسجيل الدخول تظهر هنا أيضًا.</p></div><span className="badge bg-primary/15 text-primary">{pending.length} بانتظار المراجعة</span></div></section>
      {error && <div className="hud-card p-4 text-sm border-destructive/30 mt-4"><b className="text-destructive">تعذر المزامنة:</b><span className="text-muted-foreground"> {error}</span></div>}
      {loading ? <div className="hud-card p-5 text-center mt-4">جاري تحميل الطلبات…</div> : <>
        {pending.length === 0 ? <div className="hud-card p-5 text-center text-sm text-muted-foreground mt-4">لا توجد طلبات بانتظار المراجعة.</div> : <section className="mt-4"><div className="text-sm font-bold mb-2">الطلبات الجديدة <span className="badge bg-destructive/15 text-destructive">{pending.length}</span></div><div className="space-y-3">{pending.map(r => <RequestCard key={`${r.type}:${r.id}`} request={r} busy={busy === r.id} review={review} />)}</div></section>}
        {history.length > 0 && <section className="pt-5"><div className="text-sm font-bold mb-2">السجل السابق</div><div className="space-y-2">{history.slice(0, 50).map(r => <HistoryCard key={`${r.type}:${r.id}`} request={r} />)}</div></section>}
      </>}
    </ManagerLayout>
  );
}

const HistoryCard = memo(function HistoryCard({ request }: { request: any }) {
  return <section className="hud-card p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-bold">{request.employeeName} · {request.jobNumber}</div><div className="text-xs text-muted-foreground mt-1">طلب {typeLabel(request.type)} · {request.reason || "بدون سبب"}</div></div><span className="badge">{statusLabel(request.status)}</span></div></section>;
});

const RequestCard = memo(function RequestCard({ request, busy, review }: { request: any; busy: boolean; review: (id: string, status: "approved" | "rejected", type?: string) => Promise<void> }) {
  const isRebind = request.type === "device-rebind";
  return <section className={`hud-card p-4 ${isRebind ? "border-warning/40 bg-warning/5" : "border-primary/20"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-extrabold">{request.employeeName} <span className="text-muted-foreground font-normal">· {request.jobNumber}</span></div><div className={`text-sm font-semibold mt-1 ${isRebind ? "text-[hsl(var(--warning))]" : "text-primary"}`}>طلب {typeLabel(request.type)}</div><div className="text-xs text-muted-foreground mt-1">{request.reason || "بدون سبب"}</div>{isRebind && request.deviceLabel && <div className="text-xs text-muted-foreground mt-1">الهاتف المطلوب: {request.deviceLabel}</div>}<div className="text-[11px] text-muted-foreground mt-1">{new Date(request.createdAt).toLocaleString("ar-SA")}</div></div><div className="flex gap-2"><button disabled={busy} onClick={() => void review(request.id, "approved", request.type)} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold disabled:opacity-50">{busy ? "جاري…" : "موافقة"}</button><button disabled={busy} onClick={() => void review(request.id, "rejected", request.type)} className="rounded-xl border border-destructive/30 text-destructive px-4 py-2 text-xs font-bold disabled:opacity-50">رفض</button></div></div></section>;
});
