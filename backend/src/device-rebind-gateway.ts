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

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleDeviceRebind(request, env, origin(request, env));
    if (response) return response;
    return base.fetch(request, env, ctx);
  },
};
