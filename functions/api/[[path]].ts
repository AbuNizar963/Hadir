const API_ORIGIN = "https://hadir-api.abunizar963.workers.dev";

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

  // The Pages proxy must forward authentication cookies exactly as separate
  // Set-Cookie headers. Cloudflare runtimes may expose getSetCookie(), but older
  // runtimes can expose only get(). The backend currently emits one durable
  // hadir_session cookie, so the fallback is safe and prevents the cookie from
  // being silently dropped in a standalone PWA context.
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof cookieHeaders.getSetCookie === "function"
    ? cookieHeaders.getSetCookie()
    : (() => {
        const value = response.headers.get("set-cookie");
        return value ? [value] : [];
      })();
  responseHeaders.delete("set-cookie");
  for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
