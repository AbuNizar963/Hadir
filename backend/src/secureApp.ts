import app from "./app";

type Env = { APP_ORIGIN?: string };
const SESSION_COOKIE = "hadir_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 5;

function originFor(request: Request, env: Env): string {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const allowed = String(env.APP_ORIGIN || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean);
  return incoming && allowed.includes(incoming) ? incoming : allowed[0] || incoming || "*";
}

export function sanitizeAuthResponse(response: Response, token: unknown, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "content-type, authorization, x-device-id");
  headers.set("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  if (typeof token === "string" && token.length > 0) {
    headers.append("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=None`);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const response = await app.fetch(request, env as never, ctx);
    if (request.headers.get("x-hadir-internal-auth") === "1") return response;
    if (request.method !== "POST" || (url.pathname !== "/api/auth/login" && url.pathname !== "/api/bootstrap/owner")) return response;

    const data = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || typeof data?.token !== "string") return response;
    const { token: _token, ...safeData } = data;
    const safeResponse = new Response(JSON.stringify(safeData), { status: response.status, statusText: response.statusText, headers: response.headers });
    return sanitizeAuthResponse(safeResponse, data.token, originFor(request, env));
  },
};
