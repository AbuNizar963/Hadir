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

  // Chromium expects each Set-Cookie value as a separate response header.
  // The backend may set both the durable auth session and the device cookie.
  // Preserve every Set-Cookie instead of allowing a proxy Headers operation to
  // collapse them into a comma-separated value.
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof cookieHeaders.getSetCookie === "function") {
    const cookies = cookieHeaders.getSetCookie();
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}