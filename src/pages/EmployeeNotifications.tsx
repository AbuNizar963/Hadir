import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";
import { currentSession } from "@/lib/auth";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  removeNotification,
  syncNotificationsFromD1,
  type AppNotification,
} from "@/lib/notifications";

const FALLBACK_REFRESH_MS = 120000;

export default function EmployeeNotifications() {
  const session = currentSession();
  const userId = session?.employeeId || "";
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      await syncNotificationsFromD1();
      setItems(userId ? getNotifications(userId) : getNotifications());
    } catch {
      setItems(userId ? getNotifications(userId) : []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();

    let timer: number | null = null;

    const scheduleFallback = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      timer = window.setTimeout(() => {
        timer = null;
        void refresh();
      }, FALLBACK_REFRESH_MS);
    };

    const onDataChanged = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
      scheduleFallback();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
        scheduleFallback();
      } else if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    window.addEventListener("hadir:cloud-data-changed", onDataChanged);
    window.addEventListener("hadir:d1-view-changed", onDataChanged);
    window.addEventListener("online", onDataChanged);
    document.addEventListener("visibilitychange", onVisibility);
    scheduleFallback();

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      window.removeEventListener("hadir:cloud-data-changed", onDataChanged);
      window.removeEventListener("hadir:d1-view-changed", onDataChanged);
      window.removeEventListener("online", onDataChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const unread = useMemo(
    () => items.filter((notification) => !notification.read).length,
    [items],
  );

  const readOne = (id: string): void => {
    markAsRead(id);
    setItems((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification,
      ),
    );
  };

  const readAll = (): void => {
    markAllAsRead(userId);
    setItems((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4" dir="rtl">
      <section className="hud-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/12 grid place-items-center text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">HADIR · EMPLOYEE</div>
              <h2 className="text-2xl font-black">مركز الإشعارات</h2>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="rounded-xl border border-border p-2 hover:bg-secondary"
            title="تحديث"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {unread > 0
              ? `${unread} إشعار غير مقروء`
              : "لا توجد إشعارات غير مقروءة"}
          </span>
          {unread > 0 && (
            <button
              onClick={readAll}
              className="font-semibold text-primary"
            >
              <CheckCheck className="ml-1 inline h-4 w-4" />
              تحديد الكل كمقروء
            </button>
          )}
        </div>
      </section>

      <section className="hud-card overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            جارٍ تحميل الإشعارات...
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <div className="mt-3 font-bold">لا توجد إشعارات حالياً</div>
            <div className="mt-1 text-xs text-muted-foreground">
              ستظهر هنا حالة طلباتك والتنبيهات الإدارية.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((notification) => (
              <li
                key={notification.id}
                className={`p-4 ${!notification.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                      notification.type === "success"
                        ? "bg-primary"
                        : notification.type === "error"
                          ? "bg-destructive"
                          : notification.type === "warning"
                            ? "bg-[hsl(var(--warning))]"
                            : "bg-accent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-bold">{notification.title}</div>
                      <button
                        onClick={() => {
                          removeNotification(notification.id);
                          setItems((current) =>
                            current.filter(
                              (item) => item.id !== notification.id,
                            ),
                          );
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      {notification.body}
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground mono">
                      {new Date(notification.createdAt).toLocaleString("ar-EG")}
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => readOne(notification.id)}
                        className="mt-2 text-xs font-semibold text-primary"
                      >
                        تحديد كمقروء
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
