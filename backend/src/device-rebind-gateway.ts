import base, { HadirRealtime } from "./automation-entry";
import { handleDeviceRebind } from "./device-rebind-api";
import { handleDailyStatus } from "./daily-status-api";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

function origin(request: Request, env: Env) {
  const requestOrigin = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = [String(env.APP_ORIGIN || ""), String(env.APP_ORIGINS || "")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (requestOrigin && configured.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^https:\/\/[^/]+\.pages\.dev$/i.test(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) return requestOrigin;
  return configured[0] || "*";
}

const dailyCors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
};

function dailyError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...dailyCors },
  });
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleDeviceRebind(request, env, origin(request, env));
    if (response) return response;

    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, "") === "/api/manager/daily-status") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: dailyCors });

      try {
        // This endpoint can execute before the workforce router. Keep its D1
        // dependency self-contained instead of relying on another route to
        // lazily create leave_requests.
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          type TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewer_id TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL
        )`).run();
        await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates ON leave_requests(employee_id,start_date,end_date)").run();

        const actorProbe = new URL(request.url);
        actorProbe.pathname = "/api/me";
        actorProbe.search = "";
        const probe = await base.fetch(new Request(actorProbe, { method: "GET", headers: request.headers }), env, ctx);
        const actor = probe.ok ? ((await probe.json().catch(() => ({})) as any).user || null) : null;
        return handleDailyStatus(request, env, actor);
      } catch (error) {
        console.error("daily-status failed", error);
        return dailyError("تعذر قراءة حالة الدوام من D1. تم تسجيل الخطأ في Worker Logs.");
      }
    }

    return base.fetch(request, env, ctx);
  },
};
