import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BrainCircuit, CloudSun, Landmark, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  clearNotifications,
  getNotifications,
  markAllAsRead,
  markAsRead,
  NOTIFICATIONS_CHANGED_EVENT,
  removeNotification,
  syncNotificationsFromD1,
  type AppNotification,
} from "@/lib/notifications";
import { enableWebPush } from "@/lib/push";

interface Props {
  userId?: string;
}

const FALLBACK_REFRESH_MS = 120000;

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const refresh = useMemo(
    () => async () => {
      if (!userId) {
        setItems([]);
        return;
      }

      await syncNotificationsFromD1();
      setItems(getNotifications(userId));
    },
    [userId],
  );

  useEffect(() => {
    void refresh();

    let timer: number | undefined;

    const schedule = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      timer = window.setTimeout(() => {
        timer = undefined;
        void refresh();
        schedule();
      }, FALLBACK_REFRESH_MS);
    };

    const sync = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
      schedule();
    };

    const visibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        schedule();
      } else if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    window.addEventListener("hadir:cloud-data-changed", sync);
    window.addEventListener("hadir:d1-view-changed", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", visibility);
    schedule();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
      window.removeEventListener("hadir:cloud-data-changed", sync);
      window.removeEventListener("hadir:d1-view-changed", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.read).length,
    [items],
  );

  const handleNotification = (notification: AppNotification) => {
    markAsRead(notification.id);
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    setOpen(false);

    const route = notificationRoute(notification);
    if (route) {
      navigate(route);
    }
  };

  const handleBellClick = () => {
    if (userId) {
      void enableWebPush(userId);
    }

    setOpen((value) => !value);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead(userId);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  };

  const handleClearAll = () => {
    if (!items.length) {
      return;
    }

    clearNotifications(userId);
    setItems([]);
  };

  const handleRemove = (id: string) => {
    removeNotification(id);
    setItems((current) =>
      current.filter((notification) => notification.id !== id),
    );
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2" dir="rtl">
      <ToolButton label="المساعد الذكي" onClick={() => navigate("/ai")}>
        <BrainCircuit className="h-5 w-5" />
        <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </ToolButton>

      <ToolButton label="الطقس" onClick={() => navigate("/weather")}>
        <CloudSun className="h-5 w-5" />
        <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </ToolButton>

      <ToolButton
        label="مواقيت الصلاة والقبلة"
        onClick={() => navigate("/prayer")}
      >
        <Landmark className="h-5 w-5" />
        <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </ToolButton>

      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={handleBellClick}
          className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="الإشعارات"
          aria-expanded={open}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center mono">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <div className="text-sm font-extrabold">الإشعارات</div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-primary font-semibold"
                  >
                    تعليم الكل كمقروء
                  </button>
                )}

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] text-destructive font-semibold"
                  >
                    حذف الكل
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  لا توجد إشعارات حالياً.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((notification) => (
                    <li
                      key={notification.id}
                      onClick={() => handleNotification(notification)}
                      className={`p-3 cursor-pointer transition hover:bg-secondary/50 ${
                        !notification.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <TypeDot type={notification.type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-bold truncate">
                              {notification.title}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemove(notification.id);
                              }}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              aria-label="حذف"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {notification.body}
                          </div>
                          <div className="text-[10px] text-muted-foreground mono mt-1">
                            {formatWhen(notification.createdAt)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-12 w-12 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground grid place-items-center shadow-sm transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function notificationRoute(notification: AppNotification) {
  const text = `${notification.title} ${notification.body}`.toLowerCase();

  if (
    text.includes("إعادة ربط") ||
    text.includes("فك ربط") ||
    text.includes("هاتف جديد") ||
    text.includes("طلب") ||
    text.includes("إجازة") ||
    text.includes("استئذان")
  ) {
    return "/manager/requests";
  }

  if (notification.type === "error") {
    return "/manager/audit";
  }

  if (text.includes("تقرير")) {
    return "/manager/reports";
  }

  if (text.includes("موظف")) {
    return "/manager/employees";
  }

  return "";
}

function TypeDot({ type }: { type: AppNotification["type"] }) {
  const color =
    type === "success"
      ? "bg-primary"
      : type === "warning"
        ? "bg-[hsl(var(--warning))]"
        : type === "error"
          ? "bg-destructive"
          : "bg-accent";

  return (
    <span
      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${color}`}
      aria-hidden="true"
    />
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) {
    return "الآن";
  }

  if (minutes < 60) {
    return `قبل ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `قبل ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `قبل ${days} يوم`;
  }

  return date.toLocaleDateString("ar-EG");
}
