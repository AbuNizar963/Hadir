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

  // The installed PWA authenticates against the Pages origin. Do not forward
  // the Worker-origin session cookie: doing so creates competing cookies for
  // the same logical session and makes standalone Chromium storage behavior
  // unpredictable. The Pages proxy owns the browser session cookie.
  responseHeaders.delete("set-cookie");

  if (incomingUrl.pathname === "/api/auth/login" && response.ok) {
    const data = await response.clone().json().catch(() => null) as { token?: unknown } | null;
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (token) {
      responseHeaders.append(
        "set-cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`
      );
    }
  }

  if (incomingUrl.pathname === "/api/bootstrap/owner" && response.ok) {
    const data = await response.clone().json().catch(() => null) as { token?: unknown } | null;
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (token) {
      responseHeaders.append(
        "set-cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`
      );
    }
  }

  if (incomingUrl.pathname === "/api/auth/logout") {
    responseHeaders.append(
      "set-cookie",
      `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
