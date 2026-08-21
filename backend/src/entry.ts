import app from "./app";
import { HadirRealtime } from "./realtime";

type Env = { REALTIME: DurableObjectNamespace; DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket };
const cors = (origin: string) => ({ "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" });
function actorIdFromToken(request: Request): string | null { const url = new URL(request.url); const token = (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("token") || "").trim(); if (!token) return null; try { const payload = token.split(".")[1]; if (!payload) return null; const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4); const actor = JSON.parse(atob(padded)) as { id?: string; exp?: number }; if (!actor.id || !actor.exp || actor.exp < Math.floor(Date.now() / 1000)) return null; return actor.id; } catch { return null; } }
function realtimeId(env: Env) { return env.REALTIME.idFromName("hadir-global"); }
async function broadcast(env: Env, payload: Record<string, unknown>) { if (!env.REALTIME) return; const stub = env.REALTIME.get(realtimeId(env)); await stub.fetch("https://realtime/broadcast", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => undefined); }
function readCookie(request: Request, name: string): string | null { const cookies = request.headers.get("cookie") || ""; const item = cookies.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length + 1)) : null; }
function validDeviceId(value: string | null): value is string { return Boolean(value && value.trim().length >= 8 && value.trim().length <= 200); }
function createDeviceId() { return `dev-cookie-${crypto.randomUUID()}`; }
async function ensureDeviceIdentity(request: Request): Promise<{ request: Request; deviceId: string; setCookie: boolean }> {
  const headerId = request.headers.get("x-device-id")?.trim() || null;
  const cookieId = readCookie(request, "hadir_device_id");
  const deviceId = validDeviceId(headerId) ? headerId : validDeviceId(cookieId) ? cookieId : createDeviceId();
  const headers = new Headers(request.headers);
  headers.set("x-device-id", deviceId);
  let nextRequest: Request;
  if (new URL(request.url).pathname === "/api/auth/login" && request.method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
    const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (body) { if (!String(body.deviceId || "").trim()) body.deviceId = deviceId; if (!String(body.deviceLabel || "").trim()) body.deviceLabel = "متصفح الهاتف"; }
    nextRequest = new Request(request, { headers, body: body ? JSON.stringify(body) : undefined });
  } else nextRequest = new Request(request, { headers });
  return { request: nextRequest, deviceId, setCookie: !validDeviceId(cookieId) || cookieId !== deviceId };
}
function addDeviceCookie(response: Response, deviceId: string, setCookie: boolean): Response { if (!setCookie) return response; const headers = new Headers(response.headers); headers.append("Set-Cookie", `hadir_device_id=${encodeURIComponent(deviceId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
export { HadirRealtime };
export default { async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> { const url = new URL(request.url); const origin = env.APP_ORIGIN || "*"; if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) }); if (url.pathname === "/api/realtime" && request.method === "GET") { const userId = actorIdFromToken(request); if (!userId) return new Response("غير مصرح", { status: 401, headers: cors(origin) }); if (!env.REALTIME) return new Response("Realtime غير مفعّل", { status: 503, headers: cors(origin) }); const stub = env.REALTIME.get(realtimeId(env)); const connectUrl = new URL("https://realtime/connect"); connectUrl.searchParams.set("userId", userId); const response = await stub.fetch(connectUrl, { method: "GET" }); return response.status === 101 ? response : new Response("Realtime connection failed", { status: 502, headers: cors(origin) }); }
  const prepared = await ensureDeviceIdentity(request); const mutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/"); const response = await app.fetch(prepared.request, env, ctx); if (mutation && response.ok) ctx.waitUntil(broadcast(env, { type: "cloud-data-changed", timestamp: new Date().toISOString(), path: url.pathname, method: request.method })); return addDeviceCookie(response, prepared.deviceId, prepared.setCookie); } };