export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

const K_NOTIFICATIONS = "hadir.notifications";
const EVT_CHANGED = "hadir:notifications-changed";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FALLBACK_REFRESH_MS = 120000;
const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const APP_BASE = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const NOTIFICATION_ICON = `${APP_BASE}/pwa-192x192.png`;
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";

function headers(): Headers {
  const result = new Headers({ "content-type": "application/json" });

  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem(ADMIN_TOKEN_KEY) ||
      localStorage.getItem(EMPLOYEE_TOKEN_KEY) ||
      "";

    if (token) {
      result.set("authorization", `Bearer ${token}`);
    }
  }

  return result;
}

function isRecent(notification: AppNotification): boolean {
  const time = Date.parse(notification.createdAt);
  return Number.isFinite(time) && Date.now() - time <= RETENTION_MS;
}

function prune(list: AppNotification[]): AppNotification[] {
  return list.filter(isRecent).slice(0, 200);
}

function readAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(K_NOTIFICATIONS);
    return raw ? prune(JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: AppNotification[]): void {
  try {
    localStorage.setItem(K_NOTIFICATIONS, JSON.stringify(prune(list)));
  } catch {
    // Local notification storage is a cache; a storage failure must not break the UI.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT_CHANGED));
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  if (
    Notification.permission === "granted" ||
    Notification.permission === "denied"
  ) {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function showBrowserNotification(notification: AppNotification): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) =>
          registration.showNotification(notification.title, {
            body: notification.body,
            tag: `hadir-${notification.id}`,
            icon: NOTIFICATION_ICON,
            badge: NOTIFICATION_ICON,
          }),
        )
        .catch(() => {
          new Notification(notification.title, { body: notification.body });
        });
    } else {
      new Notification(notification.title, { body: notification.body });
    }
  } catch {
    // Browser notification support is optional.
  }
}

async function fetchDeletedIds(): Promise<Set<string>> {
  try {
    const response = await fetch(`${API_URL}/api/notifications/deleted`, {
      headers: headers(),
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return new Set();
    }

    const rows = (await response.json()) as any[];
    return new Set(
      rows
        .map((row) => String(row.notificationId || ""))
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export async function syncNotificationsFromD1(): Promise<void> {
  try {
    const [response, deletedIds] = await Promise.all([
      fetch(`${API_URL}/api/notifications`, {
        headers: headers(),
        credentials: "include",
        cache: "no-store",
      }),
      fetchDeletedIds(),
    ]);

    if (!response.ok) {
      return;
    }

    const rows = (await response.json()) as any[];
    const previous = new Map(readAll().map((notification) => [notification.id, notification]));
    const mapped = prune(
      rows
        .filter((row) => !deletedIds.has(String(row.id)))
        .map(
          (row) =>
            ({
              id: String(row.id),
              userId: String(row.recipientId ?? row.userId ?? ""),
              title: String(row.title ?? "إشعار"),
              body: String(row.message ?? row.body ?? ""),
              type: (row.severity === "danger"
                ? "error"
                : row.severity === "warning"
                  ? "warning"
                  : row.severity === "success"
                    ? "success"
                    : row.type ?? "info") as NotificationType,
              read: Boolean(row.readAt),
              createdAt: String(row.createdAt),
            }) satisfies AppNotification,
        ),
    );

    for (const notification of mapped) {
      if (!previous.has(notification.id)) {
        showBrowserNotification(notification);
      }
    }

    writeAll(mapped);
  } catch {
    // Notification sync is best-effort; the cached notification list remains usable.
  }
}

let polling = false;

export function startNotificationPolling(): () => void {
  if (polling || typeof window === "undefined") {
    return () => {};
  }

  polling = true;
  void syncNotificationsFromD1();

  let timer: number | undefined;

  const schedule = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    timer = window.setTimeout(() => {
      timer = undefined;
      void syncNotificationsFromD1();
      schedule();
    }, FALLBACK_REFRESH_MS);
  };

  const onVisibility = (): void => {
    if (document.visibilityState === "visible") {
      void syncNotificationsFromD1();
      schedule();
    } else if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  schedule();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }

    document.removeEventListener("visibilitychange", onVisibility);
    polling = false;
  };
}

export function addNotification(
  notification: Omit<AppNotification, "id" | "read" | "createdAt">,
): AppNotification {
  const next: AppNotification = {
    ...notification,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };

  writeAll([next, ...readAll()]);
  showBrowserNotification(next);
  return next;
}

export function getNotifications(userId?: string): AppNotification[] {
  const list = readAll();
  return userId
    ? list.filter((notification) => notification.userId === userId || !notification.userId)
    : list;
}

export function getUnreadCount(userId?: string): number {
  return getNotifications(userId).filter((notification) => !notification.read).length;
}

export function markAsRead(id: string): void {
  const list = readAll().map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification,
  );

  writeAll(list);

  void fetch(`${API_URL}/api/notifications/read`, {
    method: "POST",
    headers: headers(),
    credentials: "include",
    body: JSON.stringify({ id }),
  }).catch(() => undefined);
}

export function markAllAsRead(userId?: string): void {
  const list = readAll().map((notification) =>
    !userId || notification.userId === userId
      ? { ...notification, read: true }
      : notification,
  );

  writeAll(list);

  void fetch(`${API_URL}/api/notifications/read`, {
    method: "POST",
    headers: headers(),
    credentials: "include",
    body: "{}",
  }).catch(() => undefined);
}

export function removeNotification(id: string): void {
  writeAll(readAll().filter((notification) => notification.id !== id));

  void fetch(`${API_URL}/api/notifications`, {
    method: "DELETE",
    headers: headers(),
    credentials: "include",
    body: JSON.stringify({ id }),
  }).catch(() => undefined);
}

export function clearNotifications(userId?: string): void {
  writeAll(
    userId
      ? readAll().filter((notification) => notification.userId !== userId)
      : [],
  );

  void fetch(`${API_URL}/api/notifications`, {
    method: "DELETE",
    headers: headers(),
    credentials: "include",
    body: "{}",
  }).catch(() => undefined);
}

export const NOTIFICATIONS_CHANGED_EVENT = EVT_CHANGED;
