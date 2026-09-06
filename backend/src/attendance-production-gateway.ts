import base, { HadirRealtime } from "./employee-save-production-gateway";
import { handleEmployeeAttendance } from "./employee-attendance-gateway";

type Env = {
  DB: D1Database;
  REALTIME: DurableObjectNamespace;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  REPORT_ARCHIVE?: R2Bucket;
  BROWSER?: BrowserRun;
};

function origin(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = String(env.APP_ORIGIN || env.APP_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (incoming && configured.includes(incoming)) return incoming;
  if (!configured.length && incoming && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming)) return incoming;
  return configured[0] || "*";
}

async function sessionUser(request: Request, env: Env, ctx: ExecutionContext) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";
  const probe = await base.fetch(new Request(probeUrl, { method: "GET", headers: request.headers }), env, ctx);
  if (!probe.ok) return null;
  const data = await probe.json().catch(() => ({})) as any;
  return data?.user || null;
}

async function broadcastAttendance(env: Env, request: Request, response: Response) {
  if (request.method !== "POST" || !response.ok || !env.REALTIME) return;
  try {
    const stub = env.REALTIME.get(env.REALTIME.idFromName("hadir-global"));
    await stub.fetch("https://realtime/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "cloud-data-changed", timestamp: new Date().toISOString(), path: "/api/attendance", method: "POST" }),
    });
  } catch {}
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if ((url.pathname === "/api/attendance" || url.pathname === "/api/attendance/") && (request.method === "GET" || request.method === "POST")) {
      const actor = await sessionUser(request, env, ctx);
      const response = await handleEmployeeAttendance(request, env, actor, origin(request, env));
      if (response) {
        await broadcastAttendance(env, request, response);
        return response;
      }
    }
    return base.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const scheduled = (base as any).scheduled;
    if (typeof scheduled === "function") return scheduled(controller, env, ctx);
  },
};
