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

  // Production Pages can use the configured canonical hostname, while previews/custom
  // aliases may legitimately send a different Origin. Never emit '*' together with
  // credentials; echo only origins that are explicitly trusted by policy.
  if (requestOrigin && configured.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^https:\/\/[^/]+\.pages\.dev$/i.test(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) return requestOrigin;
  return configured[0] || "*";
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
