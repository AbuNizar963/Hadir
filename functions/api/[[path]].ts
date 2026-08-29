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

  // Do not collapse multiple Set-Cookie headers. The Worker can legitimately
  // set both the authentication session and the device identity cookie on the
  // same response. Chromium PWAs are especially sensitive to malformed or
  // comma-joined Set-Cookie values. Preserve each cookie as its own header.
  const cookies = typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [];
  responseHeaders.delete("set-cookie");
  for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}