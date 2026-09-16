import { type ReactNode, useEffect, useState } from "react";
import {
  Bell,
  Bot,
  Building2,
  CloudSun,
  Clock3,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { currentSession } from "@/lib/auth";
import { backendLogout } from "@/lib/backend";
import {
  getNotifications,
  syncNotificationsFromD1,
} from "@/lib/notifications";
import "./EmployeeLayout.css";

const NAV = [
  {
    to: "/employee",
    label: "لوحة الموظف",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/employee/center",
    label: "مركز الموظف",
    icon: Building2,
  },
  {
    to: "/employee/history",
    label: "سجل العمل",
    icon: Clock3,
  },
  {
    to: "/employee/profile",
    label: "الملف الشخصي",
    icon: UserRound,
  },
];

const utilityClass =
  "group flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary";

const THEME_KEY = "hadir.theme";

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";

  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

async function loadEmployeeUnreadCount(employeeId: string) {
  if (!employeeId) return 0;

  try {
    await syncNotificationsFromD1();
    return getNotifications(employeeId).filter(
      (notification) => !notification.read,
    ).length;
  } catch {
    try {
      return getNotifications(employeeId).filter(
        (notification) => !notification.read,
      ).length;
    } catch {
      return 0;
    }
  }
}

export default function EmployeeLayout({
  title = "لوحة الموظف",
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const session = currentSession();
  const navigate = useNavigate();
  const employeeId = String(session?.employeeId || "");

  useEffect(() => {
    applyTheme(theme);

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");

    media.addEventListener?.("change", onChange);

    return () => media.removeEventListener?.("change", onChange);
  }, [theme]);

  useEffect(() => {
    let active = true;
    let fallbackTimer: number | undefined;

    const load = async () => {
      const count = await loadEmployeeUnreadCount(employeeId);
      if (active) {
        setUnreadNotifications(count);
      }
    };

    const scheduleFallback = () => {
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }

      if (document.visibilityState !== "visible") return;

      fallbackTimer = window.setTimeout(() => {
        void load();
        scheduleFallback();
      }, 120000);
    };

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
      scheduleFallback();
    };

    void load();
    scheduleFallback();

    window.addEventListener("hadir:cloud-data-changed", refresh);
    window.addEventListener("hadir:d1-view-changed", refresh);
    const onNotificationsChanged = () => {
      try {
        setUnreadNotifications(
          getNotifications(employeeId).filter(
            (notification) => !notification.read,
          ).length,
        );
      } catch {
        setUnreadNotifications(0);
      }
    };

    window.addEventListener("hadir:notifications-changed", onNotificationsChanged);
    window.addEventListener("storage", refresh);
    window.addEventListener("online", refresh);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      } else if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;

      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }

      window.removeEventListener("hadir:cloud-data-changed", refresh);
      window.removeEventListener("hadir:d1-view-changed", refresh);
      window.removeEventListener("hadir:notifications-changed", onNotificationsChanged);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [employeeId]);

  const logout = async () => {
    try {
      await backendLogout();
    } catch {}

    try {
      localStorage.removeItem("hadir.api.token.employee");
      localStorage.removeItem("hadir.employee.session");
      localStorage.removeItem("hadir.session");
      localStorage.removeItem("employeeAuth");
    } catch {}

    setMenuOpen(false);
    setThemeMenuOpen(false);
    navigate("/login", { replace: true });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setThemeMenuOpen(false);
  };

  return (
    <div className="employee-shell min-h-screen bg-background text-foreground" dir="rtl">
      <div className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-2 sm:px-4">
          <Link
            to="/employee"
            aria-label="حاضر"
            onClick={closeMenu}
            className="shrink-0"
          >
            <Brand />
          </Link>

          <nav
            className="flex min-w-0 items-center gap-1.5 overflow-x-auto"
            aria-label="أدوات النظام"
          >
            <button
              type="button"
              title="القائمة"
              aria-label="القائمة"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((value) => !value);
                setThemeMenuOpen(false);
              }}
              className={cn(
                utilityClass,
                "employee-menu-trigger",
                menuOpen && "border-primary/40 bg-primary/5 text-primary",
              )}
            >
              {menuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                القائمة
              </span>
            </button>

            <Link
              to="/employee/notifications"
              title="الإشعارات"
              aria-label="الإشعارات"
              className={`${utilityClass} relative`}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute right-0 top-0 z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground mono">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                الإشعارات
              </span>
            </Link>

            <Link
              to="/weather"
              title="الطقس"
              aria-label="الطقس"
              onClick={closeMenu}
              className={utilityClass}
            >
              <CloudSun className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                الطقس
              </span>
            </Link>

            <Link
              to="/prayer"
              title="القبلة"
              aria-label="القبلة"
              onClick={closeMenu}
              className={utilityClass}
            >
              <Compass className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                القبلة
              </span>
            </Link>

            <Link
              to="/ai"
              title="المساعد"
              aria-label="المساعد"
              onClick={closeMenu}
              className={utilityClass}
            >
              <Bot className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                المساعد
              </span>
            </Link>
          </nav>
        </div>

        <div className="border-t border-border/60">
          <nav
            className="mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-2 py-1.5 sm:justify-center sm:px-4"
            aria-label="تنقل الموظف"
          >
            {NAV.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end as any}
                  onClick={closeMenu}
                  aria-label={item.label}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      "flex min-w-[86px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition",
                      isActive
                        ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-sm"
                        : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {menuOpen && (
        <div
          className="employee-utility-menu z-50"
          dir="rtl"
          role="menu"
          aria-label="خيارات القائمة"
        >
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((value) => !value)}
                aria-expanded={themeMenuOpen}
                className="w-full rounded-lg px-3 py-2 text-right text-sm font-semibold hover:bg-secondary"
                role="menuitem"
              >
                <Palette className="mr-1 inline h-4 w-4" />
                المظهر
              </button>

              {themeMenuOpen && (
                <div className="absolute right-full top-0 z-50 mr-1 w-48 rounded-xl border border-border bg-card p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("dark");
                      setThemeMenuOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-secondary",
                      theme === "dark" && "bg-primary/10 text-primary",
                    )}
                  >
                    <Moon className="mr-2 inline h-4 w-4" />
                    داكن
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("light");
                      setThemeMenuOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-secondary",
                      theme === "light" && "bg-primary/10 text-primary",
                    )}
                  >
                    <Sun className="mr-2 inline h-4 w-4" />
                    فاتح
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("system");
                      setThemeMenuOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-secondary",
                      theme === "system" && "bg-primary/10 text-primary",
                    )}
                  >
                    <Monitor className="mr-2 inline h-4 w-4" />
                    تلقائي
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg px-3 py-2 text-right text-sm font-semibold text-destructive hover:bg-destructive/10"
              role="menuitem"
            >
              <LogOut className="mr-1 inline h-4 w-4" />
              تسجيل خروج
            </button>
          </div>
        </div>
      )}

      <header className="mx-auto max-w-7xl border-b border-border/40 px-4 pb-5 pt-7 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground mono">
              HADIR · EMPLOYEE
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          {actions}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-10">
        {children}
      </main>
    </div>
  );
}
