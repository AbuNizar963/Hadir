import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllAsRead, markAsRead, removeNotification, clearNotifications, NOTIFICATIONS_CHANGED_EVENT, type AppNotification } from "@/lib/notifications";

interface Props { userId?: string; }

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const refresh = useMemo(() => () => { setItems(userId ? getNotifications(userId) : []); }, [userId]);

  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const handleClickItem = (notification: AppNotification) => {
    markAsRead(notification.id); refresh(); setOpen(false);
    const route = notificationRoute(notification); if (route) navigate(route);
  };
  if (!userId) return null;

  return <div className="flex items-center gap-2" dir="rtl">
    <button type="button" onClick={() => navigate("/weather")} className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="فتح صفحة الطقس">
      <span className="text-xl leading-none animate-[pulse_3s_ease-in-out_infinite]" aria-hidden="true">🌤️</span>
      <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
    </button>

    <div className="relative" ref={wrapRef}>
      <button type="button" onClick={() => setOpen(v => !v)} className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="الإشعارات" aria-expanded={open}>
        <BellIcon />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center mono">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && <div className="absolute left-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0"><div className="text-sm font-extrabold">الإشعارات</div><div className="flex items-center gap-2">{unreadCount > 0 && <button type="button" onClick={() => { markAllAsRead(userId); refresh(); }} className="text-[11px] text-primary hover:brightness-125 font-semibold">تعليم الكل كمقروء</button>}{items.length > 0 && <button type="button" onClick={() => { if (confirm("سيتم حذف كل الإشعارات. هل أنت متأكد؟")) { clearNotifications(userId); refresh(); } }} className="text-[11px] text-destructive hover:brightness-125 font-semibold">مسح الكل</button>}</div></div>
        <div className="overflow-y-auto flex-1">{items.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">لا توجد إشعارات حالياً.</div> : <ul className="divide-y divide-border">{items.map((n) => <li key={n.id} onClick={() => handleClickItem(n)} className={`p-3 cursor-pointer transition hover:bg-secondary/50 ${!n.read ? "bg-primary/5" : ""}`}>
          <div className="flex items-start gap-2"><TypeDot type={n.type} /><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div className="text-sm font-bold truncate">{notificationTitle(n)}</div><button type="button" onClick={(e) => { e.stopPropagation(); removeNotification(n.id); refresh(); }} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="حذف"><XIcon /></button></div><div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div><div className="text-[10px] text-muted-foreground mono mt-1">{formatWhen(n.createdAt)}</div></div></div>
        </li>)}</ul>}</div>
      </div>}
    </div>
  </div>;
}

function notificationTitle(n: AppNotification): string { if (n.title === "طلب موظف جديد") { const match = n.body.match(/طلب\s+(استئذان|إجازة|انصراف)/); return match ? `طلب ${match[1]} جديد` : "طلب موظف جديد"; } return n.title; }
function notificationRoute(n: AppNotification): string | null { const text = `${n.title} ${n.body}`.toLowerCase(); if (text.includes("طلب") || text.includes("إجازة") || text.includes("استئذان") || text.includes("انصراف")) return "/manager/requests"; if (n.type === "error" || text.includes("خطأ") || text.includes("فشل")) return "/manager/audit"; if (text.includes("تقرير") || text.includes("report")) return "/manager/reports"; if (text.includes("موظف") || text.includes("employee")) return "/manager/employees"; if (text.includes("إعداد") || text.includes("settings")) return "/manager/settings"; return null; }
function TypeDot({ type }: { type: AppNotification["type"] }) { const color = type === "success" ? "bg-primary" : type === "warning" ? "bg-[hsl(var(--warning))]" : type === "error" ? "bg-destructive" : "bg-accent"; return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden="true" />; }
function BellIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>; }
function formatWhen(iso: string): string { const d = new Date(iso); const diffMin = Math.floor((Date.now() - d.getTime()) / 60000); if (diffMin < 1) return "الآن"; if (diffMin < 60) return `قبل ${diffMin} دقيقة`; const diffHr = Math.floor(diffMin / 60); if (diffHr < 24) return `قبل ${diffHr} ساعة`; const diffDay = Math.floor(diffHr / 24); if (diffDay < 7) return `قبل ${diffDay} يوم`; return d.toLocaleDateString("ar-EG"); }