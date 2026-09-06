import production from "./attendance-production-gateway";

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

async function isStaff(request: Request, env: Env, ctx: ExecutionContext) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";
  const probe = await production.fetch(new Request(probeUrl, { method: "GET", headers: request.headers }), env, ctx);
  if (!probe.ok) return false;
  const data = await probe.json().catch(() => ({})) as any;
  return data?.user?.role === "staff";
}

function sanitizeAttendanceResponse(response: Response) {
  return response.clone().json().then((data: any) => {
    if (!Array.isArray(data)) return response;
    const now = Date.now();
    const safe = data.filter((row: any) => {
      const timestamp = Date.parse(String(row?.timestamp || ""));
      return Number.isFinite(timestamp) && timestamp <= now + 5000;
    });
    return new Response(JSON.stringify(safe), {
      status: response.status,
      headers: response.headers,
    });
  }).catch(() => response);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const attendanceGet = (url.pathname === "/api/attendance" || url.pathname === "/api/attendance/") && request.method === "GET";
    const response = await production.fetch(request, env, ctx);
    if (!attendanceGet || !response.ok) return response;
    if (!(await isStaff(request, env, ctx))) return response;
    return sanitizeAttendanceResponse(response);
  },
  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const scheduled = (production as any).scheduled;
    if (typeof scheduled === "function") return scheduled(controller, env, ctx);
  },
};
