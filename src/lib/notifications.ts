// نظام الإشعارات المخزّن محلياً في المتصفح
// يوفر واجهة موحدة لإضافة/جلب/تحديث/حذف الإشعارات لكل مستخدم

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  userId: string; // "admin" للمدير، أو jobNumber للموظف
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

const K_NOTIFICATIONS = "hadir.notifications";
const EVT_CHANGED = "hadir:notifications-changed";

function readAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(K_NOTIFICATIONS);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function writeAll(list: AppNotification[]) {
  localStorage.setItem(K_NOTIFICATIONS, JSON.stringify(list));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT_CHANGED));
  }
}

/**
 * إضافة إشعار جديد إلى قائمة إشعارات مستخدم محدد
 */
export function addNotification(
  n: Omit<AppNotification, "id" | "read" | "createdAt">
): AppNotification {
  const list = readAll();
  const notif: AppNotification = {
    ...n,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  list.unshift(notif);
  // الاحتفاظ بأحدث 200 إشعار فقط لتفادي امتلاء التخزين المحلي
  const capped = list.slice(0, 200);
  writeAll(capped);
  return notif;
}

/**
 * جلب إشعارات مستخدم محدد (أو الكل إذا لم يُحدَّد المستخدم)
 */
export function getNotifications(userId?: string): AppNotification[] {
  const list = readAll();
  if (!userId) return list;
  return list.filter((n) => n.userId === userId);
}

/**
 * عدد الإشعارات غير المقروءة للمستخدم
 */
export function getUnreadCount(userId?: string): number {
  return getNotifications(userId).filter((n) => !n.read).length;
}

/**
 * تعليم إشعار كمقروء
 */
export function markAsRead(id: string) {
  const list = readAll();
  const idx = list.findIndex((n) => n.id === id);
  if (idx >= 0) {
    list[idx].read = true;
    writeAll(list);
  }
}

/**
 * تعليم كل إشعارات المستخدم كمقروءة
 */
export function markAllAsRead(userId?: string) {
  const list = readAll();
  let changed = false;
  for (const n of list) {
    if ((!userId || n.userId === userId) && !n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) writeAll(list);
}

/**
 * حذف إشعار محدد
 */
export function removeNotification(id: string) {
  const list = readAll().filter((n) => n.id !== id);
  writeAll(list);
}

/**
 * حذف كل إشعارات المستخدم (أو الكل)
 */
export function clearNotifications(userId?: string) {
  if (!userId) {
    writeAll([]);
    return;
  }
  const list = readAll().filter((n) => n.userId !== userId);
  writeAll(list);
}

export const NOTIFICATIONS_CHANGED_EVENT = EVT_CHANGED;
