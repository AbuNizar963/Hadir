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
            onClick={closeTransient}
            className="shrink-0"
            aria-label="الرئيسية"
          >
            <Brand compact />
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-black sm:text-lg">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowNotifications((value) => !value);
                setMenuOpen(false);
                setThemeMenuOpen(false);
                setShowDiagnostics(false);
              }}
              className="relative rounded-xl p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="الإشعارات"
              title="الإشعارات"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen((value) => !value);
                setShowNotifications(false);
                setThemeMenuOpen(false);
                setShowDiagnostics(false);
              }}
              className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="القائمة"
              title="القائمة"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {actions && (
          <div className="mx-auto max-w-7xl px-2 pb-2 sm:px-4">{actions}</div>
        )}

        {showNotifications && (
          <div className="manager-notification-panel absolute left-2 right-2 top-full z-[70] mx-auto max-w-xl rounded-2xl border border-border bg-card p-2 shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2 pb-2">
              <div>
                <p className="font-bold">الإشعارات</p>
                <p className="text-xs text-muted-foreground">
                  {unreadCount} غير مقروء
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleReadAllNotifications()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-muted"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  تحديد الكل كمقروء
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  لا توجد إشعارات جديدة.
                </p>
              ) : (
                notifications.map((notification) => {
                  const route = notificationRoute(notification);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        void handleReadNotification(notification.id);
                        if (route) nav(route);
                        setShowNotifications(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-right transition hover:bg-muted",
                        !notification.read && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                          notification.read
                            ? "bg-muted-foreground/30"
                            : "bg-primary",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          {notificationTitle(notification)}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {notification.body}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground/80">
                          {new Date(notification.createdAt).toLocaleString(
                            "ar-SA",
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/70 px-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  void reloadNotifications();
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold hover:bg-muted"
              >
                تحديث
              </button>
              <button
                type="button"
                onClick={() => {
                  clearNotifications(currentUserId);
                  setNotifications([]);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                مسح
              </button>
            </div>
          </div>
        )}

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="إغلاق القائمة"
              onClick={closeTransient}
              className="fixed inset-0 z-[65] bg-black/50"
            />
            <div className="manager-utility-menu fixed left-2 right-2 top-[calc(var(--hadir-manager-topbar-h)+8px)] z-[70] mx-auto max-w-md rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <div className="grid gap-1">
                {filteredNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={closeTransient}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                <div className="my-1 border-t border-border/70" />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setThemeMenuOpen((value) => !value)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-muted"
                  >
                    <Palette className="h-5 w-5" aria-hidden="true" />
                    <span>المظهر</span>
                    {theme === "light" && (
                      <Sun className="mr-auto h-4 w-4" aria-hidden="true" />
                    )}
                    {theme === "dark" && (
                      <Moon className="mr-auto h-4 w-4" aria-hidden="true" />
                    )}
                    {theme === "system" && (
                      <Monitor
                        className="mr-auto h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {themeMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-[80] mt-1 rounded-xl border border-border bg-card p-1 shadow-xl">
                      {(
                        [
                          ["light", "فاتح", Sun],
                          ["dark", "داكن", Moon],
                          ["system", "النظام", Monitor],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setThemeAndKeepMenu(
                              value as "light" | "dark" | "system",
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
                            theme === value
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted",
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={openDiagnostics}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-muted"
                >
                  <Wrench className="h-5 w-5" aria-hidden="true" />
                  <span>تشخيص النظام</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </>
        )}

        {showDiagnostics && (
          <>
            <button
              type="button"
              aria-label="إغلاق التشخيص"
              onClick={closeTransient}
              className="fixed inset-0 z-[75] bg-black/50"
            />
            <div className="fixed inset-x-2 top-[calc(var(--hadir-manager-topbar-h)+8px)] z-[80] mx-auto max-h-[75vh] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                <div>
                  <p className="font-bold">تشخيص النظام</p>
                  <p className="text-xs text-muted-foreground">
                    {diagnostics.length} سجل
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiagnostics([])}
                  className="rounded-lg p-2 hover:bg-muted"
                  aria-label="مسح التشخيص"
                  title="مسح التشخيص"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {diagnostics.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  لا توجد سجلات تشخيصية.
                </p>
              ) : (
                <div className="space-y-2 py-2">
                  {diagnostics.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border/70 bg-background/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{entry.message}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {entry.code} · {entry.level}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString("ar-SA")}
                        </span>
                      </div>
                      {entry.details && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 text-[10px] leading-5 text-muted-foreground">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <main className="mx-auto w-full max-w-7xl px-2 pb-8 pt-4 sm:px-4">
        {children}
      </main>
    </div>
  );
}
