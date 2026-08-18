import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { getNotifications, markAsRead as markNotificationAsRead } from "@/lib/notifications";
import type { AppNotification } from "@/lib/notifications";

const NAV = [
  { to: "/manager", label: "لوحة القيادة", end: true },
  { to: "/manager/employees", label: "الموظفون" },
  { to: "/manager/audit", label: "سجل التدقيق" },
  { to: "/manager/reports", label: "التقارير" },
  { to: "/manager/settings", label: "الإعدادات", managerOnly: true },
];

export default function ManagerLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const loadNotifs = () => {
      try {
        const all = getNotifications();
        if (Array.isArray(all)) {
          setNotifications(all.filter((n) => n.userId === "manager" || n.userId === "admin" || n.userId === "all"));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadNotifs();
    const interval = setInterval(loadNotifs, 3000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const logout = () => {
    // مسح حالة الدخول من التخزين المحلي
    localStorage.removeItem("managerAuth");
    nav("/manager/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* الشريط الجانبي */}
      <aside className="fixed top-0 right-0 bottom-0 w-64 border-l border-border/70 bg-sidebar/95 backdrop-blur-md hidden lg:flex flex-col z-40">
        <div className="p-5 border-b border-border/60">
          <Brand />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end as any}
              className={({ isActive }) =>
                cn(
                  "block rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <button onClick={logout} className="btn-secondary w-full">
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="lg:mr-64">
        {/* شريط الموبايل العلوي */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <Brand />
            <button onClick={logout} className="btn-ghost text-xs">خروج</button>
          </div>

          <div className="px-2 pb-2 flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end as any}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* الهيدر الرئيسي */}
        <header className="px-5 lg:px-10 pt-6 pb-4 border-b border-border/40 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground mono">MANAGER</div>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{title}</h1>
              {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
            </div>

            <div className="flex items-center gap-3 relative">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 rounded-xl bg-card border border-border shadow-sm text-foreground hover:bg-secondary transition flex items-center gap-2 text-sm font-semibold"
                  type="button"
                >
                  <span className="text-base">🔔 الإشعارات</span>
                  {unreadCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl p-4 z-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold">الإشعارات ({unreadCount})</span>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        إغلاق ✕
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          لا توجد إشعارات جديدة
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkAsRead(n.id)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                              n.read
                                ? "bg-secondary/20 border-border/40 opacity-60"
                                : "bg-primary/10 border-primary/30 font-semibold"
                            }`}
                          >
                            <div className="text-foreground font-bold">{n.title}</div>
                            <div className="text-muted-foreground text-[11px] mt-1">{n.body}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {actions}
            </div>
          </div>
        </header>

        <main className="px-5 lg:px-10 pb-16">{children}</main>
      </div>
    </div>
  );
}
