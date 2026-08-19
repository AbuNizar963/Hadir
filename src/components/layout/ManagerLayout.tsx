import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { getNotifications, markAsRead as markNotificationAsRead } from "@/lib/notifications";
import type { AppNotification } from "@/lib/notifications";
import { getManagerSession, setManagerSession } from "@/lib/storage";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState("system"); // system | light | dark

  // جلب جلسة المدير الحالية لمعرفة الصلاحيات والدور
  const managerSession = getManagerSession();
  const currentRole = managerSession?.role || "manager"; // owner, manager, supervisor

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
    localStorage.removeItem("managerAuth");
    setManagerSession(null);
    nav("/manager/login");
  };

  const goSettings = () => {
    setMenuOpen(false);
    nav("/manager/settings");
  };

  // تطبيق الوضع حسب الاختيار
  useEffect(() => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  // تصفية الروابط بحيث تظهر الإعدادات فقط للمالك والمدير العام
  const filteredNav = NAV.filter((n) => {
    if (n.managerOnly) {
      return currentRole === "owner" || currentRole === "manager";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* الشريط الجانبي */}
      <aside className="fixed top-0 right-0 bottom-0 w-64 border-l border-border/70 bg-sidebar/95 backdrop-blur-md hidden lg:flex flex-col z-40">
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <Brand />
        </div>
        {managerSession && (
          <div className="px-5 py-2.5 border-b border-border/40 text-xs text-muted-foreground bg-secondary/30">
            مرحباً، <span className="font-bold text-foreground">{managerSession.name || currentRole}</span>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          {filteredNav.map((n) => (
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
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="lg:mr-64">
        {/* شريط الموبايل العلوي */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <Brand />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg border border-border text-sm font-semibold"
              >
                ☰
              </button>

              {menuOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-lg p-2 space-y-2 z-50">
                  <button
                    onClick={() => {
                      setShowNotifications(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm"
                  >
                    🔔 الإشعارات {unreadCount > 0 && `(${unreadCount})`}
                  </button>
                  
                  {(currentRole === "owner" || currentRole === "manager") && (
                    <button
                      onClick={goSettings}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm"
                    >
                      ⚙️ الإعدادات
                    </button>
                  )}

                  {/* خيار الوضع */}
                  <div className="relative">
                    <button
                      onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm"
                    >
                      🎨 الوضع
                    </button>
                    {themeMenuOpen && (
                      <div className="mt-1 border border-border rounded-lg bg-card shadow-lg">
                        <button
                          onClick={() => { setTheme("light"); setThemeMenuOpen(false); setMenuOpen(false); }}
                          className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary"
                        >
                          ☀️ الوضع المشرق
                        </button>
                        <button
                          onClick={() => { setTheme("dark"); setThemeMenuOpen(false); setMenuOpen(false); }}
                          className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary"
                        >
                          🌙 الوضع الداكن
                        </button>
                        <button
                          onClick={() => { setTheme("system"); setThemeMenuOpen(false); setMenuOpen(false); }}
                          className="block w-full text-right px-3 py-2 text-sm hover:bg-secondary"
                        >
                          🖥️ تلقائي (حسب النظام)
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={logout}
                    className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm text-red-600"
                  >
                    🚪 تسجيل خروج
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-2 pb-2 flex gap-1 overflow-x-auto">
            {filteredNav.map((n) => (
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
              <div className="text-xs text-muted-foreground mono">MANAGER · {currentRole.toUpperCase()}</div>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{title}</h1>
              {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
            </div>

            {actions}
          </div>
        </header>

        <main className="px-5 lg:px-10 pb-16">{children}</main>
      </div>
    </div>
  );
}
