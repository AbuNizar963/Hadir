import { type ReactNode, useEffect, useState, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bot, CloudSun, Compass, LayoutDashboard, Menu, UserRound, X, Clock3, CreditCard, Building2, LogOut, Bell, CheckCheck, Trash2 } from "lucide-react";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { currentSession } from "@/lib/auth";
import { backendLogout } from "@/lib/backend";
import { getNotifications, markAllAsRead, markAsRead, removeNotification, startNotificationPolling, type AppNotification, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications";

const NAV = [
  { to: "/employee", label: "لوحة الموظف", icon: LayoutDashboard, end: true },
  { to: "/employee/center", label: "مركز الموظف", icon: Building2 },
  { to: "/employee/premium", label: "البطاقة والخدمات", icon: CreditCard },
  { to: "/employee/history", label: "سجل العمل", icon: Clock3 },
  { to: "/employee/profile", label: "الملف الشخصي", icon: UserRound },
];
const utilityClass = "group flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary";

export default function EmployeeLayout({ title = "لوحة الموظف", subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const session = currentSession();
  const navigate = useNavigate();
  const currentUserId = String(session?.employeeId || "");

  const reloadNotifications = useCallback(() => {
    const all = getNotifications(currentUserId);
    setNotifications(all.filter(n => !n.userId || n.userId === currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    const stop = startNotificationPolling();
    reloadNotifications();
    const onChanged = () => reloadNotifications();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => { stop(); window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged); };
  }, [reloadNotifications]);

  useEffect(() => { if (showNotifications) reloadNotifications(); }, [showNotifications, reloadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const logout = async () => { try { await backendLogout(); } catch {} try { localStorage.removeItem("hadir.api.token.employee"); localStorage.removeItem("hadir.employee.session"); localStorage.removeItem("employeeAuth"); } catch {} setMenuOpen(false); navigate("/login", { replace: true }); };

  return <div className="min-h-screen bg-background text-foreground" dir="rtl">
    <div className="sticky top-0 z-[60] border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-2 sm:px-4">
        <Link to="/employee" aria-label="حاضر" className="shrink-0"><Brand /></Link>
        <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="أدوات النظام">
          <button type="button" title="القائمة" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} className={cn(utilityClass, menuOpen && "border-primary/40 bg-primary/5 text-primary")}>{menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}<span className="mt-0.5 text-[11px] font-semibold leading-none">القائمة</span></button>
          <Link to="/weather" title="الطقس" aria-label="الطقس" className={utilityClass}><CloudSun className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">الطقس</span></Link>
          <Link to="/prayer" title="القبلة" aria-label="القبلة" className={utilityClass}><Compass className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">القبلة</span></Link>
          <Link to="/ai" title="المساعد" aria-label="المساعد" className={utilityClass}><Bot className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">المساعد</span></Link>
          <button type="button" onClick={() => setShowNotifications(true)} title="الإشعارات" aria-label="الإشعارات" className="relative hidden h-12 w-12 shrink-0 place-items-center rounded-xl border border-border/70 bg-background/70 hover:border-primary/40 hover:bg-primary/5 sm:grid"><Bell className="h-5 w-5" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{unreadCount}</span>}</button>
        </nav>
      </div>
      <div className="border-t border-border/60"><nav className="mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-2 py-1.5 sm:justify-center sm:px-4" aria-label="تنقل الموظف">{NAV.map(n => { const Icon = n.icon; return <NavLink key={n.to} to={n.to} end={n.end as any} aria-label={n.label} title={n.label} className={({ isActive }) => cn("flex min-w-[86px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition", isActive ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-sm" : "text-foreground/80 hover:bg-secondary hover:text-foreground")}><Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none">{n.label}</span></NavLink>; })}</nav></div>
    </div>
    {menuOpen && <div className="sticky top-[138px] z-50 border-b border-border/60 bg-card/98 shadow-lg"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2" dir="rtl"><span className="rounded-lg px-3 py-2 text-xs text-muted-foreground">{session?.employeeId ? "حساب الموظف" : "الموظف"}</span><button type="button" onClick={() => void logout()} className="rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOut className="mr-1 inline h-4 w-4" aria-hidden="true" />تسجيل خروج</button></div></div>}
    <header className="mx-auto max-w-7xl border-b border-border/40 px-4 pb-5 pt-7 sm:px-6 lg:px-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-semibold tracking-widest text-muted-foreground mono">HADIR · EMPLOYEE</div><h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>{subtitle && <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</div>}</div>{actions}</div></header>
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-10">{children}</main>
    {showNotifications && <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-5" onClick={() => setShowNotifications(false)}><div className="absolute left-3 top-3 w-[24rem] max-w-[calc(100%-1.5rem)] max-h-[82vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:left-5 sm:top-5" onClick={e => e.stopPropagation()}><div className="border-b border-border/60 p-4"><div className="flex items-center justify-between gap-2"><div><div className="font-bold">الإشعارات</div><div className="mt-1 text-[11px] text-muted-foreground">يتم الاحتفاظ بالإشعارات لمدة شهر واحد.</div></div><button type="button" onClick={() => setShowNotifications(false)} className="rounded-lg px-2 py-1 hover:bg-secondary" aria-label="إغلاق"><X className="h-4 w-4" /></button></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => { markAllAsRead(currentUserId); reloadNotifications(); }} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-secondary"><CheckCheck className="mr-1 inline h-4 w-4" />قراءة الكل</button></div></div><div className="max-h-[62vh] overflow-y-auto p-3">{notifications.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">لا توجد إشعارات حالياً.</div> : notifications.map(n => <div key={n.id} className={cn("mb-2 rounded-xl border p-3", !n.read && "border-primary/30 bg-primary/5")}><div className="flex items-start justify-between gap-2"><div><div className="font-semibold text-sm">{n.title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{n.body}</div><div className="mt-2 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString("ar-SA")}</div></div><div className="flex shrink-0 gap-1"><button type="button" title="قراءة" onClick={() => { markAsRead(n.id); reloadNotifications(); }} className="rounded-lg p-2 hover:bg-secondary" aria-label="قراءة"><CheckCheck className="h-4 w-4" /></button><button type="button" title="حذف" onClick={() => { removeNotification(n.id); reloadNotifications(); }} className="rounded-lg p-2 hover:bg-secondary" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div></div></div>}
  </div>;
}
