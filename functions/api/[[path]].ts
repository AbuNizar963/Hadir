const API_ORIGIN = "https://hadir-api.abunizar963.workers.dev";
const SESSION_COOKIE = "hadir_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 5;

export async function onRequest(context: {
  request: Request;
  params: { path?: string[] };
}): Promise<Response> {
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(API_ORIGIN);
  targetUrl.pathname = incomingUrl.pathname;
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(context.request.headers);
  headers.set("origin", incomingUrl.origin);
  headers.delete("host");

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  const response = await fetch(new Request(targetUrl.toString(), init));
  const responseHeaders = new Headers(response.headers);

  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.delete("access-control-allow-headers");
  responseHeaders.delete("access-control-allow-methods");

  // Preserve every upstream Set-Cookie as an independent header.
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof cookieHeaders.getSetCookie === "function"
    ? cookieHeaders.getSetCookie()
    : (() => {
        const value = response.headers.get("set-cookie");
        return value ? [value] : [];
      })();
  responseHeaders.delete("set-cookie");
  for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);

  // The Pages origin is the actual origin of the installed PWA. Persist the
  // authenticated session on that origin as a first-class HttpOnly cookie.
  // This deliberately uses the token returned by the backend only for the
  // login response; subsequent requests never expose the token to the page.
  if (incomingUrl.pathname === "/api/auth/login" && response.ok) {
    const data = await response.clone().json().catch(() => null) as { token?: unknown } | null;
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (token) {
      responseHeaders.append(
        "set-cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
      );
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
