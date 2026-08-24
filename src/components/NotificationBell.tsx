import { useEffect, useMemo, useState } from "react";
import { Bell, BrainCircuit, CloudSun, Landmark, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllAsRead, markAsRead, removeNotification, clearNotifications, NOTIFICATIONS_CHANGED_EVENT, type AppNotification } from "@/lib/notifications";

interface Props { userId?: string; onlyBell?: boolean; }
const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
function token() { return localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token.employee") || ""; }
async function backendNotifications(): Promise<AppNotification[]> {
  const t = token();
  if (!t) return [];
  try {
    const r = await fetch(`${API_URL}/api/notifications`, { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
    if (!r.ok) return [];
    const rows = await r.json() as any[];
    return Array.isArray(rows) ? rows.map(n => ({ id: String(n.id), userId: String(n.recipientId || ""), title: String(n.title || "إشعار"), body: String(n.body || ""), type: (n.severity === "danger" ? "error" : n.severity === "warning" ? "warning" : n.severity === "success" ? "success" : "info") as AppNotification["type"], read: Boolean(n.readAt), createdAt: String(n.createdAt) })) : [];
  } catch { return []; }
}

export default function NotificationBell({ userId, onlyBell = false }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const navigate = useNavigate();
  const refresh = useMemo(() => async () => {
    const remote = await backendNotifications();
    setItems(remote.length || token() ? remote : (userId ? getNotifications(userId) : []));
  }, [userId]);

  useEffect(() => {
    void refresh();
    const sync = () => void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 10000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);
  const handle = async (n: AppNotification) => {
    const t = token();
    if (t) await fetch(`${API_URL}/api/notifications/read`, { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ id: n.id }) }).catch(() => undefined);
    markAsRead(n.id);
    void refresh();
    setOpen(false);
    const route = notificationRoute(n);
    if (route) navigate(route);
  };

  if (!userId) return null;
  return <div className="flex items-center gap-2" dir="rtl">
    {onlyBell ? null : <>
      <ToolButton label="المساعد الذكي" onClick={() => navigate("/ai")}><BrainCircuit className="h-5 w-5" /><span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /></ToolButton>
      <ToolButton label="الطقس" onClick={() => navigate("/weather")}><CloudSun className="h-5 w-5" /><span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /></ToolButton>
      <ToolButton label="مواقيت الصلاة والقبلة" onClick={() => navigate("/prayer")}><Landmark className="h-5 w-5" /><span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /></ToolButton>
    </>}

    <button type="button" onClick={() => setOpen(true)} className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="الإشعارات" aria-expanded={open}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center mono">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>

    {open && <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="الإشعارات" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="absolute left-3 top-3 w-[24rem] max-w-[calc(100%-1.5rem)] max-h-[82vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:left-5 sm:top-5" dir="rtl" onMouseDown={e => e.stopPropagation()}>
        <div className="border-b border-border/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div><div className="font-bold">الإشعارات</div><div className="mt-1 text-[11px] text-muted-foreground">يتم الاحتفاظ بالإشعارات لمدة شهر واحد.</div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 hover:bg-secondary" aria-label="إغلاق"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex gap-2">
            {unreadCount > 0 && <button type="button" onClick={async () => { const t = token(); if (t) await fetch(`${API_URL}/api/notifications/read`, { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: "{}" }).catch(() => undefined); markAllAsRead(userId); void refresh(); }} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">تعليم الكل كمقروء</button>}
            {items.length > 0 && <button type="button" onClick={() => { clearNotifications(userId); void refresh(); }} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10">مسح المحلي</button>}
          </div>
        </div>
        <div className="max-h-[calc(82vh-105px)] overflow-y-auto">
          {items.length === 0 ? <div className="p-12 text-center text-xs text-muted-foreground">لا توجد إشعارات حالياً.</div> : <ul className="divide-y divide-border">{items.map(n => <li key={n.id} onClick={() => void handle(n)} className={`cursor-pointer p-4 transition hover:bg-secondary/50 ${!n.read ? "bg-primary/5" : ""}`}>
            <div className="flex items-start gap-3"><TypeDot type={n.type} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="truncate text-sm font-bold">{n.title}</div><button type="button" onClick={e => { e.stopPropagation(); removeNotification(n.id); void refresh(); }} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="حذف"><X className="h-4 w-4" /></button></div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</div><div className="mono mt-1 text-[10px] text-muted-foreground">{formatWhen(n.createdAt)}</div></div></div>
          </li>)}</ul>}
        </div>
      </div>
    </div>}
  </div>;
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label={label}>{children}</button>; }
function notificationRoute(n: AppNotification) { const text = `${n.title} ${n.body}`.toLowerCase(); if (text.includes("إعادة ربط") || text.includes("هاتف جديد")) return "/manager/employees"; if (text.includes("طلب") || text.includes("إجازة") || text.includes("استئذان")) return "/manager/requests"; if (n.type === "error") return "/manager/audit"; if (text.includes("تقرير")) return "/manager/reports"; if (text.includes("موظف")) return "/manager/employees"; return ""; }
function TypeDot({ type }: { type: AppNotification["type"] }) { const color = type === "success" ? "bg-primary" : type === "warning" ? "bg-[hsl(var(--warning))]" : type === "error" ? "bg-destructive" : "bg-accent"; return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden="true" />; }
function formatWhen(iso: string) { const d = new Date(iso); const m = Math.floor((Date.now() - d.getTime()) / 60000); if (m < 1) return "الآن"; if (m < 60) return `قبل ${m} دقيقة`; const h = Math.floor(m / 60); if (h < 24) return `قبل ${h} ساعة`; const day = Math.floor(h / 24); if (day < 7) return `قبل ${day} يوم`; return d.toLocaleDateString("ar-EG"); }
