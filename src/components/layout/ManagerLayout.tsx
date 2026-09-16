import { useState, useEffect, useCallback, useRef } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Bell,
  Bot,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Settings,
  Sun,
  Trash2,
  Users,
  Wrench,
  X,
  CloudSun,
  Compass,
} from "lucide-react";
import Brand from "@/components/Brand";
import SessionWelcome from "@/components/SessionWelcome";
import "./ManagerLayout.css";
import { cn } from "@/lib/utils";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  clearNotifications,
  getNotifications,
  markAllAsRead,
  markAsRead as markNotificationAsRead,
  removeNotification,
  syncNotificationsFromD1,
  type AppNotification,
} from "@/lib/notifications";
import { getManagerSession, setManagerSession } from "@/lib/storage";
import { backendLogout } from "@/lib/backend";
import {
  getDiagnostics,
  clearDiagnostics,
  type DiagnosticEntry,
} from "@/lib/systemDiagnostics";

const THEME_KEY = "hadir.theme";

type NotificationsChangedDetail = {
  notificationIds?: string[];
};

type ManagerNavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  editRoles?: string[];
};

const NAV: ManagerNavItem[] = [
  {
    to: "/manager",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    end: true,
    editRoles: ["owner", "manager", "supervisor"],
  },
  {
    to: "/manager/employees",
    label: "الموظفون",
    icon: Users,
    editRoles: ["owner", "manager", "supervisor"],
  },
  {
    to: "/manager/workforce",
    label: "قوى العمل",
    icon: ClipboardCheck,
    editRoles: ["owner", "manager", "supervisor"],
  },
  {
    to: "/manager/requests",
    label: "الطلبات",
    icon: ClipboardList,
    editRoles: ["owner", "manager"],
  },
  {
    to: "/manager/audit",
    label: "التدقيق",
    icon: Wrench,
    editRoles: ["owner", "manager", "supervisor"],
  },
  {
    to: "/manager/reports",
    label: "التقارير",
    icon: BarChart3,
    editRoles: ["owner", "manager"],
  },
  {
    to: "/manager/report-archive",
    label: "أرشيف التقارير",
    icon: Archive,
    editRoles: ["owner", "manager"],
  },
  {
    to: "/manager/settings",
    label: "الإعدادات",
    icon: Settings,
    editRoles: ["owner"],
  },
];

async function loadServerNotifications(): Promise<AppNotification[]> {
  await syncNotificationsFromD1();
  return getNotifications();
}

async function markServerNotificationRead(id: string) {
  markNotificationAsRead(id);
}

async function markServerNotificationsRead() {
  markAllAsRead();
}

function readTheme(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "system";

  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" || value === "system"
      ? value
      : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (typeof document === "undefined") return;

  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

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
  const managerSession = getManagerSession();
  const currentRole = managerSession?.role || "manager";
  const currentUserId = String(
    (managerSession as any)?.accountId ||
      (managerSession as any)?.id ||
      (managerSession as any)?.userId ||
      "",
  );
  const topbarRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    readTheme(),
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;

    const sync = () => {
      const rect = el.getBoundingClientRect();
      document.documentElement.style.setProperty(
        "--hadir-manager-topbar-h",
        `${Math.max(0, Math.ceil(rect.bottom))}px`,
      );
    };

    sync();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(el);
    window.addEventListener("resize", sync);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (menuOpen && currentScrollY > lastScrollY + 2) {
        setMenuOpen(false);
        setThemeMenuOpen(false);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    let fallbackTimer: number | undefined;
    let inFlight = false;
    let queued = false;

    const scheduleFallback = () => {
      if (!active) return;

      window.clearTimeout(fallbackTimer);
      if (document.visibilityState !== "visible") return;

      fallbackTimer = window.setTimeout(() => void load(), 120000);
    };

    const load = async () => {
      if (inFlight) {
        queued = true;
        return;
      }

      inFlight = true;
      try {
        const server = await loadServerNotifications();
        if (active) {
          setNotifications(
            server.filter(
              (notification) => notification.userId === currentUserId,
            ),
          );
        }
      } catch {
        try {
          const all = getNotifications(currentUserId);
          if (active) {
            setNotifications(
              Array.isArray(all)
                ? all.filter(
                    (notification) =>
                      notification.userId === currentUserId ||
                      notification.userId === "manager" ||
                      notification.userId === "admin" ||
                      notification.userId === "all",
                  )
                : [],
            );
          }
        } catch {
          if (active) setNotifications([]);
        }
      } finally {
        inFlight = false;
        if (queued) {
          queued = false;
          void load();
        }
        scheduleFallback();
      }
    };

    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };

    const onNotificationsChanged = (event: Event) => {
      const detail = (event as CustomEvent<NotificationsChangedDetail>).detail;
      const ids = Array.isArray(detail?.notificationIds)
        ? detail.notificationIds.map(String).filter(Boolean)
        : [];

      if (ids.length > 0) {
        setNotifications((current) =>
          current.map((notification) =>
            ids.includes(notification.id)
              ? { ...notification, read: true }
              : notification,
          ),
        );
      }

      const all = getNotifications(currentUserId);
      setNotifications(
        Array.isArray(all)
          ? all.filter(
              (notification) =>
                notification.userId === currentUserId ||
                notification.userId === "manager" ||
                notification.userId === "admin" ||
                notification.userId === "all",
            )
          : [],
      );
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "hadir.api.token.admin" ||
        event.key === "managerAuth"
      ) {
        refresh();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
      } else {
        window.clearTimeout(fallbackTimer);
      }
    };

    void load();
    window.addEventListener("hadir:cloud-data-changed", refresh);
    window.addEventListener("hadir:d1-view-changed", refresh);
    window.addEventListener(
      NOTIFICATIONS_CHANGED_EVENT,
      onNotificationsChanged,
    );
    window.addEventListener("online", refresh);
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("hadir:cloud-data-changed", refresh);
      window.removeEventListener("hadir:d1-view-changed", refresh);
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        onNotificationsChanged,
      );
      window.removeEventListener("online", refresh);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [currentUserId]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener?.("change", onChange);

    return () => media.removeEventListener?.("change", onChange);
  }, [theme]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  const closeTransient = () => {
    setMenuOpen(false);
    setThemeMenuOpen(false);
    setShowNotifications(false);
    setShowDiagnostics(false);
  };

  const logout = () => {
    closeTransient();
    localStorage.removeItem("managerAuth");
    backendLogout();
    setManagerSession(null);
    nav("/manager/login");
  };

  const filteredNav = NAV.filter(
    (item) => !item.editRoles || item.editRoles.includes(currentRole),
  );

  const openDiagnostics = () => {
    setDiagnostics(getDiagnostics());
    setShowDiagnostics(true);
    setMenuOpen(false);
    setThemeMenuOpen(false);
    setShowNotifications(false);
  };

  const notificationRoute = (notification: AppNotification) => {
    const text = `${notification.title} ${notification.body}`.toLowerCase();

    if (
      notification.type === "error" ||
      text.includes("خطأ") ||
      text.includes("فشل")
    ) {
      return "/manager/audit";
    }

    if (
      text.includes("طلب") ||
      text.includes("إجازة") ||
      text.includes("استئذان") ||
      text.includes("انصراف")
    ) {
      return "/manager/requests";
    }

    if (text.includes("تقرير") || text.includes("report")) {
      return "/manager/reports";
    }

    if (text.includes("موظف") || text.includes("employee")) {
      return "/manager/employees";
    }

    if (text.includes("إعداد") || text.includes("settings")) {
      return "/manager/settings";
    }

    return null;
  };

  const notificationTitle = (notification: AppNotification) => {
    if (notification.title === "طلب موظف جديد") {
      const match = notification.body.match(/طلب\s+(استئذان|إجازة|انصراف)/);
      return match ? `طلب ${match[1]} جديد` : notification.title;
    }

    return notification.title;
  };

  const reloadNotifications = useCallback(async () => {
    try {
      const server = await loadServerNotifications();
      setNotifications(
        server.filter((notification) => notification.userId === currentUserId),
      );
    } catch {
      const all = getNotifications(currentUserId);
      setNotifications(
        all.filter(
          (notification) =>
            notification.userId === currentUserId ||
            notification.userId === "manager" ||
            notification.userId === "admin" ||
            notification.userId === "all",
        ),
      );
    }
  }, [currentUserId]);

  const setThemeAndKeepMenu = (value: "light" | "dark" | "system") => {
    setTheme(value);
    setThemeMenuOpen(false);
  };

  const handleReadNotification = async (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
    markNotificationAsRead(id);

    try {
      await markServerNotificationRead(id);
      window.dispatchEvent(
        new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, {
          detail: { notificationIds: [id] } satisfies NotificationsChangedDetail,
        }),
      );
    } catch {
      await reloadNotifications();
    }
  };

  const handleReadAllNotifications = async () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
    markAllAsRead(currentUserId);

    try {
      await markServerNotificationsRead();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      await reloadNotifications();
    }
  };

  const utilityButton = (
    to: string,
    label: string,
    Icon: typeof CloudSun,
  ) => (
    <Link
      to={to}
      onClick={closeTransient}
      title={label}
      aria-label={label}
      className="manager-tool group flex h-12 w-20 shrink-0 flex-col items-center justify-center border border-border/70 bg-background/70 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      <span className="mt-0.5 text-[11px] font-semibold leading-none">
        {label}
      </span>
    </Link>
  );

  return (
    <div
      className="manager-shell min-h-screen bg-background text-foreground"
      dir="rtl"
    >
      <div
        ref={topbarRef}
        className="manager-topbar sticky top-0 z-[60] border-b border-border/70 bg-background/95 backdrop-blur-md"
      >
        <div className="manager-brand-row mx-auto flex max-w-7xl items-center justify-between gap-3 px-2 sm:px-4">
          <Link
            to="/manager"
            aria-label="حاضر"
            onClick={closeTransient}
            className="shrink-0"
          >
            <Brand />
          </Link>

          <nav
            className="flex items-center gap-1.5 overflow-x-auto"
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
                setShowNotifications(false);
                setShowDiagnostics(false);
              }}
              className="manager-tool group flex h-12 w-20 shrink-0 flex-col items-center justify-center border border-border/70 bg-background/70 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                القائمة
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNotifications(true);
                setMenuOpen(false);
                setThemeMenuOpen(false);
                setShowDiagnostics(false);
              }}
              title="الإشعارات"
              aria-label="الإشعارات"
              className="manager-tool group relative flex h-12 w-20 shrink-0 flex-col items-center justify-center border border-border/70 bg-background/70 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Bell className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                الإشعارات
              </span>
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {utilityButton("/weather", "الطقس", CloudSun)}
            {utilityButton("/prayer", "القبلة", Compass)}
            {utilityButton("/ai", "المساعد", Bot)}
          </nav>
        </div>

        <div className="border-t border-border/60">
          <nav
            className="manager-nav mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-2 py-1.5 sm:justify-center sm:px-4"
            aria-label="إدارة النظام"
          >
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end as any}
                  onClick={closeTransient}
                  aria-label={item.label}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      "relative flex min-w-[86px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition",
                      isActive
                        ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-sm"
                        : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                  <span className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none">
                    {item.label}
                  </span>
                  {item.to === "/manager/requests" && unreadCount > 0 && (
                    <span className="absolute right-0 top-0 z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {menuOpen && (
        <div
          className="manager-utility-menu fixed left-0 right-0 z-[70] border-b border-border/60 bg-card/98 shadow-lg"
          dir="rtl"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-start gap-2 px-3 py-2">
            {currentRole === "owner" && (
              <button
                type="button"
                onClick={openDiagnostics}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
              >
                <Wrench className="mr-1 inline h-4 w-4" />
                سجل الأخطاء (
                {getDiagnostics().filter((entry) => entry.level === "error").length})
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((value) => !value)}
                aria-expanded={themeMenuOpen}
                className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary"
              >
                <Palette className="mr-1 inline h-4 w-4" />
                المظهر
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-xl">
                  <button
                    onClick={() => setThemeAndKeepMenu("dark")}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-secondary",
                      theme === "dark" && "bg-primary/10 text-primary",
                    )}
                  >
                    <Moon className="mr-2 inline h-4 w-4" />
                    داكن
                  </button>
                  <button
                    onClick={() => setThemeAndKeepMenu("light")}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-secondary",
                      theme === "light" && "bg-primary/10 text-primary",
                    )}
                  >
                    <Sun className="mr-2 inline h-4 w-4" />
                    فاتح
                  </button>
                  <button
                    onClick={() => setThemeAndKeepMenu("system")}
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
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <LogOut className="mr-1 inline h-4 w-4" />
              تسجيل خروج
            </button>
          </div>
        </div>
      )}

      <header className="manager-page-header mx-auto max-w-7xl border-b border-border/40 px-4 pb-5 pt-7 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground mono">
              HADIR · {currentRole.toUpperCase()}
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

      <main className="manager-content mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-10">
        {children}
      </main>

      <SessionWelcome />

      {showNotifications && (
        <div
          className="manager-notification-overlay fixed inset-0 z-[100] flex items-start justify-start bg-black/50 p-3 sm:p-5"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="manager-notification-panel mt-0 w-[24rem] max-w-[calc(100vw-1.5rem)] max-h-[82vh] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-primary/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold">الإشعارات</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    يتم الاحتفاظ بالإشعارات لمدة شهر واحد.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-lg px-2 py-1 hover:bg-secondary"
                  aria-label="إغلاق"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={unreadCount === 0}
                  onClick={() => void handleReadAllNotifications()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  <CheckCheck className="h-4 w-4" />
                  تحديد الكل كمقروء
                </button>
                <button
                  type="button"
                  disabled={notifications.length === 0}
                  onClick={() => {
                    clearNotifications(currentUserId);
                    setNotifications([]);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الكل
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                لا توجد إشعارات.
              </div>
            ) : (
              <div className="max-h-[58vh] space-y-1 overflow-y-auto p-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-1 rounded-xl",
                      !notification.read && "bg-primary/5",
                    )}
                  >
                    <button
                      onClick={async () => {
                        await handleReadNotification(notification.id);
                        setShowNotifications(false);
                        const route = notificationRoute(notification);
                        if (route) nav(route);
                      }}
                      className="min-w-0 flex-1 rounded-lg p-3 text-right text-sm hover:bg-secondary"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            notification.read ? "bg-muted" : "bg-primary",
                          )}
                        />
                        <div className="truncate font-bold">
                          {notificationTitle(notification)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {notification.body}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString("ar-SA")}
                      </div>
                    </button>
                    <button
                      type="button"
                      title="حذف الإشعار"
                      aria-label="حذف الإشعار"
                      onClick={() => {
                        removeNotification(notification.id);
                        setNotifications((current) =>
                          current.filter((item) => item.id !== notification.id),
                        );
                      }}
                      className="mt-2 self-start rounded-lg px-2 py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showDiagnostics && (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-auto bg-black/50 p-4"
          onClick={() => setShowDiagnostics(false)}
        >
          <div
            dir="rtl"
            className="mt-8 w-full max-w-3xl rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold mono text-primary">
                  DIAGNOSTICS · OWNER ONLY
                </div>
                <h2 className="mt-1 text-xl font-extrabold">
                  سجل أخطاء النظام
                </h2>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDiagnostics(false)}
              >
                إغلاق
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <span className="rounded-lg border px-2 py-1 text-xs">
                الأخطاء: {diagnostics.filter((entry) => entry.level === "error").length}
              </span>
              <span className="rounded-lg border px-2 py-1 text-xs">
                الإجمالي: {diagnostics.length}
              </span>
              <button
                type="button"
                className="btn-secondary mr-auto text-xs"
                onClick={() => {
                  clearDiagnostics();
                  setDiagnostics([]);
                }}
              >
                مسح السجل
              </button>
            </div>

            {diagnostics.length === 0 ? (
              <div className="rounded-xl border p-5 text-sm text-muted-foreground">
                لا توجد أخطاء مسجلة حاليًا.
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-auto">
                {diagnostics.map((diagnostic) => (
                  <details
                    key={diagnostic.id}
                    className="rounded-xl border bg-secondary/20 p-3"
                  >
                    <summary className="cursor-pointer text-sm">
                      <b className="mono">{diagnostic.code}</b> · {new Date(diagnostic.timestamp).toLocaleString("ar-SA")} · {diagnostic.message}
                    </summary>
                    <pre
                      dir="ltr"
                      className="mt-3 overflow-auto whitespace-pre-wrap break-words text-[11px] mono"
                    >
                      {JSON.stringify(
                        {
                          level: diagnostic.level,
                          code: diagnostic.code,
                          timestamp: diagnostic.timestamp,
                          message: diagnostic.message,
                          stack: diagnostic.stack,
                          context: diagnostic.context,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
