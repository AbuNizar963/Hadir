import base, { HadirRealtime } from "./automation-entry";
import { handleDeviceRebind } from "./device-rebind-api";
import { handleDailyStatus } from "./daily-status-api";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

function origin(request: Request, env: Env) {
  return String(env.APP_ORIGIN || request.headers.get("origin") || "*")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "") || "*";
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleDeviceRebind(request, env, origin(request, env));
    if (response) return response;
    const url = new URL(request.url);
    if (url.pathname.replace(/\/$/, "") === "/api/manager/daily-status") {
      const actorProbe = new URL(request.url);
      actorProbe.pathname = "/api/me";
      actorProbe.search = "";
      const probe = await base.fetch(new Request(actorProbe, { method: "GET", headers: request.headers }), env, ctx);
      const actor = probe.ok ? ((await probe.json().catch(() => ({})) as any).user || null) : null;
      return handleDailyStatus(request, env, actor, origin(request, env));
    }
    return base.fetch(request, env, ctx);
  },
};
