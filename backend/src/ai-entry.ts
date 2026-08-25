import entry, { HadirRealtime } from "./entry";
import { handleAI } from "./ai";

export { HadirRealtime };

type Env = {
  REALTIME: DurableObjectNamespace;
  DB: D1Database;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<any> };
  JWT_SECRET?: string;
  APP_ORIGIN?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ORIGIN?: string;
};

const SESSION_COOKIE = "hadir_session";
const DEVICE_COOKIE = "hadir_device_id";

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  const item = cookies.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function originFor(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const allowed = String(env.APP_ORIGIN || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean);
  if (!incoming) return allowed[0] || "*";
  return allowed.includes(incoming) ? incoming : allowed[0] || "*";
}

function cors(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization, x-device-id",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "cache-control": "no-store",
  };
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure; HttpOnly`;
}

async function sessionActor(request: Request, env: Env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const tokenHash = await hashToken(token);
    const session = await env.DB.prepare("SELECT user_id AS userId,user_type AS userType,role FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(tokenHash).first<any>();
    if (!session) return null;
    if (session.userType === "employee") {
      return await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,role FROM employees WHERE id=? AND status='active' LIMIT 1").bind(session.userId).first<any>();
    }
    return await env.DB.prepare("SELECT id,username,name,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(session.userId).first<any>();
  } catch {
    return null;
  }
}

async function sanitizeAuthResponse(request: Request, response: Response, env: Env, origin: string) {
  const path = new URL(request.url).pathname;
  if (path !== "/api/auth/login" && path !== "/api/bootstrap" && path !== "/api/bootstrap/owner") return response;
  const data = await response.clone().json().catch(() => null) as Record<string, any> | null;
  if (!data || typeof data.token !== "string") return response;
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("cache-control", "no-store");
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, data.token, path === "/api/bootstrap" ? 600 : 60 * 60 * 24 * 30));
  delete data.token;
  return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
}

function clearSession(response: Response, origin: string) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function buildAIContext(actor: any, env: Env) {
  if (actor?.role === "staff") {
    const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,work_start_time AS workStartTime,work_end_time AS workEndTime,grace_period_minutes AS gracePeriodMinutes,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_days_json AS workDaysJson FROM employees WHERE id=? LIMIT 1").bind(actor.id).first<any>();
    const attendance = await env.DB.prepare("SELECT type,timestamp,lat,lng,distance_meters AS distanceMeters,location_id AS locationId FROM attendance WHERE employee_id=? ORDER BY timestamp DESC LIMIT 1000").bind(actor.id).all<any>();
    const requests = await env.DB.prepare("SELECT type,reason,status,created_at AS createdAt FROM requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all<any>();
    const escapes = await env.DB.prepare("SELECT status,timestamp,reason FROM escape_events WHERE employee_id=? ORDER BY timestamp DESC LIMIT 100").bind(actor.id).all<any>();
    return { employee, attendance: attendance.results || [], requests: requests.results || [], escapes: escapes.results || [] };
  }
  if (!["owner", "manager", "supervisor"].includes(String(actor?.role || ""))) return null;
  const employees = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,work_start_time AS workStartTime,work_end_time AS workEndTime,grace_period_minutes AS gracePeriodMinutes,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_days_json AS workDaysJson FROM employees ORDER BY name LIMIT 5000").all<any>();
  const attendance = await env.DB.prepare("SELECT employee_id AS employeeId,job_number AS jobNumber,employee_name AS employeeName,type,timestamp,distance_meters AS distanceMeters,location_id AS locationId FROM attendance ORDER BY timestamp DESC LIMIT 5000").all<any>();
  const escapes = await env.DB.prepare("SELECT employee_id AS employeeId,job_number AS jobNumber,employee_name AS employeeName,status,timestamp,reason FROM escape_events ORDER BY timestamp DESC LIMIT 2000").all<any>();
  const requests = await env.DB.prepare("SELECT employee_id AS employeeId,employee_name AS employeeName,type,reason,status,created_at AS createdAt FROM requests ORDER BY created_at DESC LIMIT 1000").all<any>();
  return { employees: employees.results || [], attendance: attendance.results || [], escapes: escapes.results || [], requests: requests.results || [] };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const origin = originFor(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (url.pathname === "/api/ai" && request.method === "POST") {
      const actor = await sessionActor(request, env);
      if (!actor) return new Response(JSON.stringify({ ok: false, error: "غير مصرح" }), { status: 401, headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" } });
      const role = actor.role === "staff" ? "employee" : "manager";
      const data = await buildAIContext(actor, env);
      if (!data) return new Response(JSON.stringify({ ok: false, error: "لا توجد صلاحية لاستخدام المساعد" }), { status: 403, headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" } });
      const body = await request.json().catch(() => ({})) as any;
      const question = String(body?.question || "").trim();
      if (!question) return new Response(JSON.stringify({ ok: false, error: "السؤال فارغ" }), { status: 400, headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" } });
      return handleAI(new Request(request, { body: JSON.stringify({ role, question, data }) }), env);
    }

    const response = await entry.fetch(request, env, ctx);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") return clearSession(response, origin);
    return sanitizeAuthResponse(request, response, env, origin);
  },
};
