import base, { HadirRealtime } from "./automation-entry";
import { handleDeviceRebind } from "./device-rebind-api";
import { handleDailyStatus } from "./daily-status-api";
import { handleCompanyLogoRequest } from "./company-logo";
import { runAutomaticVip } from "./automatic-vip";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  PROFILE_IMAGES?: R2Bucket;
};

let leaveSchemaReady: Promise<void> | null = null;

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

function dailyCors(request: Request, env: Env) {
  const requestOrigin = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const allowOrigin = requestOrigin ? origin(request, env) : origin(request, env);
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "vary": "Origin",
    "cache-control": "no-store",
  };
}

function dailyError(message: string, request: Request, env: Env, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...dailyCors(request, env) },
  });
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleDeviceRebind(request, env, origin(request, env));
    if (response) return response;

    const logoResponse = await handleCompanyLogoRequest(request, env, null, origin(request, env));
    if (logoResponse) return logoResponse;

    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, "") === "/api/manager/daily-status") {
      const cors = dailyCors(request, env);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      try {
        if (!leaveSchemaReady) {
          leaveSchemaReady = env.DB.batch([
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
              id TEXT PRIMARY KEY,
              employee_id TEXT NOT NULL,
              start_date TEXT NOT NULL,
              end_date TEXT NOT NULL,
              type TEXT NOT NULL,
              reason TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TEXT NOT NULL,
              reviewed_at TEXT,
              reviewed_by TEXT
            )`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_history (
              id TEXT PRIMARY KEY,
              employee_id TEXT NOT NULL,
              date TEXT NOT NULL,
              status TEXT,
              check_in TEXT,
              check_out TEXT,
              late_minutes INTEGER DEFAULT 0,
              early_checkout_minutes INTEGER DEFAULT 0,
              notes TEXT,
              created_at TEXT NOT NULL
            )`),
          ]).then(() => undefined).catch((error) => { leaveSchemaReady = null; throw error; });
        }
        await leaveSchemaReady;

        const probeUrl = new URL(request.url);
        probeUrl.pathname = "/api/me";
        probeUrl.search = "";
        const probe = await base.fetch(new Request(probeUrl, { method: "GET", headers: request.headers }), env, ctx);
        if (!probe.ok) return dailyError("غير مصرح", request, env, 401);
        const user = (await probe.json().catch(() => ({})) as any).user;
        if (!user || !["owner", "manager"].includes(String(user.role))) return dailyError("غير مصرح", request, env, 403);
        return handleDailyStatus(request, env, { id: String(user.id), role: String(user.role), name: String(user.name || "") } as any, cors);
      } catch (error) {
        console.error("daily-status gateway error", error);
        return dailyError(error instanceof Error ? error.message : "تعذر تحميل حالة اليوم", request, env, 500);
      }
    }

    if (url.pathname.replace(/\/$/, "") === "/api/automatic-vip") {
      try {
        return await runAutomaticVip(request, env, origin(request, env));
      } catch (error) {
        console.error("automatic-vip gateway error", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "تعذر تنفيذ VIP التلقائي" }), { status: 500, headers: { "content-type": "application/json", ...dailyCors(request, env) } });
      }
    }

    return base.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (typeof base.scheduled === "function") await base.scheduled(controller, env, ctx);
  },
};
