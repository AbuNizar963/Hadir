import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";
import { currentSession } from "@/lib/auth";
import { getNotifications, markAllAsRead, markAsRead, removeNotification, type AppNotification } from "@/lib/notifications";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const FALLBACK_REFRESH_MS = 120000;

function authHeaders() {
  const h = new Headers();
  const token = localStorage.getItem("hadir.api.token.employee") || "";
  if (token) h.set("authorization", `Bearer ${token}`);
  return h;
}

async function loadRemote(): Promise<AppNotification[]> {
  const r = await fetch(`${API_URL}/api/notifications`, { headers: authHeaders(), credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error("notifications");
  const rows = await r.json() as any[];
  return Array.isArray(rows) ? rows.map(n => ({
    id: String(n.id), userId: String(n.recipientId ?? n.userId ?? ""),
    title: String(n.title || "إشعار"), body: String(n.message ?? n.body ?? ""),
    type: (n.severity === "danger" ? "error" : n.severity === "warning" ? "warning" : n.severity === "success" ? "success" : n.type ?? "info") as AppNotification["type"],
    read: Boolean(n.readAt), createdAt: String(n.createdAt)
  })) : [];
}

export default function EmployeeNotifications() {
  const session = currentSession();
  const userId = session?.employeeId || "";
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await loadRemote();
      setItems(remote);
    } catch {
      setItems(userId ? getNotifications(userId) : []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void refresh();
    let timer: number | null = null;
    const scheduleFallback = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => { timer = null; void refresh(); }, FALLBACK_REFRESH_MS);
    };
    const onDataChanged = () => {
      if (document.visibilityState === "visible") void refresh();
      scheduleFallback();
    };
    const onVisibility = () => { if (document.visibilityState === "visible") { void refresh(); scheduleFallback(); } else if (timer !== null) { window.clearTimeout(timer); timer = null; } };
    window.addEventListener("hadir:cloud-data-changed", onDataChanged);
    window.addEventListener("hadir:d1-view-changed", onDataChanged);
    window.addEventListener("online", onDataChanged);
    document.addEventListener("visibilitychange", onVisibility);
    scheduleFallback();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("hadir:cloud-data-changed", onDataChanged);
      window.removeEventListener("hadir:d1-view-changed", onDataChanged);
      window.removeEventListener("online", onDataChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const unread = useMemo(() => items.filter(n => !n.read).length, [items]);
  const readOne = async (id: string) => { markAsRead(id); setItems(v => v.map(n => n.id === id ? { ...n, read: true } : n)); await fetch(`${API_URL}/api/notifications/read`, { method: "POST", headers: new Headers({ ...Object.fromEntries(authHeaders().entries()), "content-type": "application/json" }), credentials: "include", body: JSON.stringify({ id }) }).catch(() => undefined); };
  const readAll = async () => { markAllAsRead(userId); setItems(v => v.map(n => ({ ...n, read: true }))); await fetch(`${API_URL}/api/notifications/read`, { method: "POST", headers: new Headers({ ...Object.fromEntries(authHeaders().entries()), "content-type": "application/json" }), credentials: "include", body: JSON.stringify({}) }).catch(() => undefined); };

  return <div className="max-w-3xl mx-auto space-y-4" dir="rtl">
    <section className="hud-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-primary/12 grid place-items-center text-primary"><Bell className="h-5 w-5" /></div><div><div className="text-xs text-muted-foreground">HADIR · EMPLOYEE</div><h2 className="text-2xl font-black">مركز الإشعارات</h2></div></div>
        <button onClick={() => void refresh()} className="rounded-xl border border-border p-2 hover:bg-secondary" title="تحديث"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{unread > 0 ? `${unread} إشعار غير مقروء` : "لا توجد إشعارات غير مقروءة"}</span>{unread > 0 && <button onClick={() => void readAll()} className="font-semibold text-primary"><CheckCheck className="ml-1 inline h-4 w-4" />تعليم الكل كمقروء</button>}</div>
    </section>
    <section className="hud-card overflow-hidden">
      {loading && items.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">جاري تحميل الإشعارات...</div> : items.length === 0 ? <div className="p-10 text-center"><Bell className="mx-auto h-9 w-9 text-muted-foreground/50" /><div className="mt-3 font-bold">لا توجد إشعارات حالياً</div><div className="mt-1 text-xs text-muted-foreground">ستظهر هنا حالة طلباتك والتنبيهات الإدارية.</div></div> : <ul className="divide-y divide-border">{items.map(n => <li key={n.id} className={`p-4 ${!n.read ? "bg-primary/5" : ""}`}><div className="flex items-start gap-3"><span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.type === "success" ? "bg-primary" : n.type === "error" ? "bg-destructive" : n.type === "warning" ? "bg-[hsl(var(--warning))]" : "bg-accent"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="font-bold">{n.title}</div><button onClick={() => { removeNotification(n.id); setItems(v => v.filter(x => x.id !== n.id)); }} className="text-muted-foreground hover:text-destructive" title="حذف"><Trash2 className="h-4 w-4" /></button></div><div className="mt-1 text-sm leading-6 text-muted-foreground">{n.body}</div><div className="mt-2 text-[10px] text-muted-foreground mono">{new Date(n.createdAt).toLocaleString("ar-EG")}</div>{!n.read && <button onClick={() => void readOne(n.id)} className="mt-2 text-xs font-semibold text-primary">تحديد كمقروء</button>}</div></div></li>)}</ul>}
    </section>
  </div>;
}
