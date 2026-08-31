import employeeGateway, { HadirRealtime } from "./employee-save-gateway";
import { handleDailyStatus } from "./daily-status-api";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  REALTIME: DurableObjectNamespace;
};

let leaveSchemaReady: Promise<void> | null = null;

function origin(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = [String(env.APP_ORIGIN || ""), String(env.APP_ORIGINS || "")]
    .flatMap(v => v.split(","))
    .map(v => v.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (incoming && (configured.length === 0 || configured.includes(incoming) || /^https:\/\/[^/]+\.pages\.dev$/i.test(incoming) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming))) return incoming;
  return configured[0] || "*";
}

function cors(request: Request, env: Env) {
  return {
    "access-control-allow-origin": origin(request, env),
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type, x-device-id",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "no-store",
    "vary": "Origin",
  };
}

async function ensureLeaveSchema(env: Env) {
  if (!leaveSchemaReady) {
    leaveSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
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
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates ON leave_requests(employee_id,start_date,end_date)"),
    ]).then(() => undefined).catch(error => {
      leaveSchemaReady = null;
      throw error;
    });
  }
  await leaveSchemaReady;
}

async function authenticatedActor(request: Request, env: Env, ctx: ExecutionContext) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";
  const probe = await employeeGateway.fetch(new Request(probeUrl, {
    method: "GET",
    headers: request.headers,
  }), env, ctx);
  if (!probe.ok) return null;
  const data = await probe.json().catch(() => ({})) as any;
  return data?.user || null;
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname.replace(/\/$/, "");

    // The dashboard read path is owned by the same production Worker as the
    // employee write path. This prevents routing regressions between D1 reads
    // and writes while keeping the existing API surface intact.
    if (path === "/api/manager/daily-status") {
      const headers = cors(request, env);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (request.method !== "GET") return new Response(JSON.stringify({ error: "الطريقة غير مدعومة" }), {
        status: 405,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" },
      });

      try {
        await ensureLeaveSchema(env);
        const actor = await authenticatedActor(request, env, ctx);
        const response = await handleDailyStatus(request, env, actor);
        const merged = new Headers(response.headers);
        for (const [key, value] of Object.entries(headers)) merged.set(key, value);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
      } catch (error) {
        console.error("production daily-status failed", error);
        return new Response(JSON.stringify({ error: "تعذر مزامنة حالة الدوام من D1" }), {
          status: 500,
          headers: { ...headers, "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    // Every other endpoint—including employee PATCH, attendance, requests,
    // notifications, device security, company logo and /api/me—continues
    // through the established employee gateway without changing its contract.
    return employeeGateway.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (typeof (employeeGateway as any).scheduled === "function") {
      await (employeeGateway as any).scheduled(controller, env, ctx);
    }
  },
};
