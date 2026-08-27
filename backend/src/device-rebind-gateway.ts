import base, { HadirRealtime } from "./automation-entry";
import { handleDeviceRebind } from "./device-rebind-api";

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

function isAllowedMutationOrigin(request: Request, env: Env) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  const requestOrigin = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  if (!requestOrigin) return true;
  const configured = String(env.APP_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (configured.length === 0) return true;
  return configured.includes(requestOrigin);
}

function forbiddenOriginResponse(request: Request, env: Env) {
  const allowedOrigin = origin(request, env);
  return new Response(JSON.stringify({ ok: false, error: "ORIGIN_NOT_ALLOWED" }), {
    status: 403,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": allowedOrigin,
      "access-control-allow-credentials": "true",
      "cache-control": "no-store",
    },
  });
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!isAllowedMutationOrigin(request, env)) return forbiddenOriginResponse(request, env);
    const response = await handleDeviceRebind(request, env, origin(request, env));
    if (response) return response;
    return base.fetch(request, env, ctx);
  },
};
