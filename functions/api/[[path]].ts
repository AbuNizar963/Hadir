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
  // The Worker uses Origin for its CORS response policy. Keep it aligned with
  // the first-party Pages origin even though the browser no longer needs CORS
  // for the public-facing request.
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

  // The Worker deliberately sets a host-only, long-lived HttpOnly session
  // cookie. Passing Set-Cookie through this same-origin proxy makes that
  // cookie belong to the Pages origin, avoiding third-party-cookie blocking
  // in installed Chrome PWAs.
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.delete("access-control-allow-headers");
  responseHeaders.delete("access-control-allow-methods");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
