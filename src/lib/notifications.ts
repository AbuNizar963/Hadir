export type NotificationType = "info" | "success" | "warning" | "error";
export interface AppNotification { id: string; userId: string; title: string; body: string; type: NotificationType; read: boolean; createdAt: string; }
const K_NOTIFICATIONS = "hadir.notifications";
const EVT_CHANGED = "hadir:notifications-changed";
const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const token = () => typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token") || "";
function readAll(): AppNotification[] { try { const raw = localStorage.getItem(K_NOTIFICATIONS); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeAll(list: AppNotification[]) { try { localStorage.setItem(K_NOTIFICATIONS, JSON.stringify(list.slice(0, 200))); } catch {} if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT_CHANGED)); }
function headers() { const h = new Headers({ "content-type": "application/json" }); const t = token(); if (t) h.set("authorization", `Bearer ${t}`); return h; }
async function syncFromD1() {
  const t = token(); if (!t) return;
  try {
    const r = await fetch(`${API_URL}/api/notifications`, { headers: headers() });
    if (!r.ok) return;
    const rows = await r.json() as any[];
    writeAll(rows.map(n => ({ id:n.id, userId:n.userId, title:n.title, body:n.message, type:n.type, read:Boolean(n.readAt), createdAt:n.createdAt })));
  } catch {}
}
export function addNotification(n: Omit<AppNotification,"id"|"read"|"createdAt">): AppNotification {
  const notif = { ...n, id: crypto.randomUUID(), read:false, createdAt:new Date().toISOString() };
  writeAll([notif, ...readAll()]);
  const t = token(); if (t) void fetch(`${API_URL}/api/notifications`, { method:"POST", headers:headers(), body:JSON.stringify({ title:n.title, message:n.body, type:n.type }) }).catch(()=>{});
  return notif;
}
export function getNotifications(userId?: string): AppNotification[] { void syncFromD1(); const list=readAll(); return userId ? list.filter(n=>n.userId===userId || !n.userId) : list; }
export function getUnreadCount(userId?: string): number { return getNotifications(userId).filter(n=>!n.read).length; }
export function markAsRead(id: string) { const list=readAll().map(n=>n.id===id?{...n,read:true}:n); writeAll(list); const t=token(); if(t) void fetch(`${API_URL}/api/notifications/read`,{method:"POST",headers:headers(),body:JSON.stringify({id})}).catch(()=>{}); }
export function markAllAsRead(userId?: string) { const list=readAll().map(n=>(!userId||n.userId===userId)?{...n,read:true}:n); writeAll(list); const t=token(); if(t) void fetch(`${API_URL}/api/notifications/read`,{method:"POST",headers:headers(),body:"{}"}).catch(()=>{}); }
export function removeNotification(id: string) { writeAll(readAll().filter(n=>n.id!==id)); }
export function clearNotifications(userId?: string) { writeAll(userId?readAll().filter(n=>n.userId!==userId):[]); }
export const NOTIFICATIONS_CHANGED_EVENT = EVT_CHANGED;
