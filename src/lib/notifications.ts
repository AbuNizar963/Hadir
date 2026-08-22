export type NotificationType = "info" | "success" | "warning" | "error";
export interface AppNotification { id: string; userId: string; title: string; body: string; type: NotificationType; read: boolean; createdAt: string; }
const K_NOTIFICATIONS = "hadir.notifications";
const EVT_CHANGED = "hadir:notifications-changed";
const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const APP_BASE = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const NOTIFICATION_ICON = `${APP_BASE}/pwa-192x192.png`;

function activeToken(): string { if (typeof window === "undefined") return ""; return localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token") || ""; }
function headers() { const h = new Headers({ "content-type": "application/json" }); const t = activeToken(); if (t) h.set("authorization", `Bearer ${t}`); return h; }
function readAll(): AppNotification[] { try { const raw = localStorage.getItem(K_NOTIFICATIONS); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeAll(list: AppNotification[]) { try { localStorage.setItem(K_NOTIFICATIONS, JSON.stringify(list.slice(0, 200))); } catch {} if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT_CHANGED)); }

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> { if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"; if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission; try { return await Notification.requestPermission(); } catch { return Notification.permission; } }
function showBrowserNotification(n: AppNotification) { if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return; try { if ("serviceWorker" in navigator) { void navigator.serviceWorker.ready.then(reg => reg.showNotification(n.title, { body: n.body, tag: `hadir-${n.id}`, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON })).catch(() => new Notification(n.title, { body: n.body })); } else new Notification(n.title, { body: n.body }); } catch {} }
async function syncFromD1() { const t = activeToken(); if (!t) return; try { const r = await fetch(`${API_URL}/api/notifications`, { headers: headers(), credentials: "include", cache: "no-store" }); if (!r.ok) return; const rows = await r.json() as any[]; const previous = new Map(readAll().map(n => [n.id, n])); const mapped = rows.map(n => ({ id:n.id, userId:n.userId, title:n.title, body:n.message, type:n.type, read:Boolean(n.readAt), createdAt:n.createdAt })) as AppNotification[]; for (const n of mapped) if (!previous.has(n.id)) showBrowserNotification(n); writeAll(mapped); } catch {} }
let polling = false;
export function startNotificationPolling() { if (polling || typeof window === "undefined") return () => {}; polling = true; void requestNotificationPermission(); void syncFromD1(); const timer = window.setInterval(() => void syncFromD1(), 15000); return () => { window.clearInterval(timer); polling = false; }; }
export function addNotification(n: Omit<AppNotification,"id"|"read"|"createdAt">): AppNotification { const notif = { ...n, id: crypto.randomUUID(), read:false, createdAt:new Date().toISOString() }; writeAll([notif, ...readAll()]); showBrowserNotification(notif); return notif; }
export function getNotifications(userId?: string): AppNotification[] { void syncFromD1(); const list=readAll(); return userId ? list.filter(n=>n.userId===userId || !n.userId) : list; }
export function getUnreadCount(userId?: string): number { return getNotifications(userId).filter(n=>!n.read).length; }
export function markAsRead(id: string) { const list=readAll().map(n=>n.id===id?{...n,read:true}:n); writeAll(list); const t=activeToken(); if(t) void fetch(`${API_URL}/api/notifications/read`,{method:"POST",headers:headers(),credentials:"include",body:JSON.stringify({id})}).catch(()=>{}); }
export function markAllAsRead(userId?: string) { const list=readAll().map(n=>(!userId||n.userId===userId)?{...n,read:true}:n); writeAll(list); const t=activeToken(); if(t) void fetch(`${API_URL}/api/notifications/read`,{method:"POST",headers:headers(),credentials:"include",body:"{}"}).catch(()=>{}); }
export function removeNotification(id: string) { writeAll(readAll().filter(n=>n.id!==id)); }
export function clearNotifications(userId?: string) { writeAll(userId?readAll().filter(n=>n.userId!==userId):[]); }
export const NOTIFICATIONS_CHANGED_EVENT = EVT_CHANGED;
