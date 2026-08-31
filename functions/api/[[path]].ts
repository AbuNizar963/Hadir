const API_ORIGIN = "https://hadir-api.abunizar963.workers.dev";

// Production proxy: employee mutations continue to reach the canonical D1-backed API.
function upstreamUrl(request: Request, path?: string): URL {
  const suffix = String(path || "").replace(/^\/+/, "");
  const url = new URL(`${API_ORIGIN}/api/${suffix}`);
  url.search = new URL(request.url).search;
  return url;
}

export async function onRequest(context: any): Promise<Response> {
  const { request, params } = context;
  const path = Array.isArray(params?.path) ? params.path.join("/") : String(params?.path || "");
  const target = upstreamUrl(request, path);
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("content-length");
  headers.set("origin", new URL(request.url).origin);
  headers.set("x-hadir-proxy", "cloudflare-pages");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const response = await fetch(target.toString(), init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.delete("access-control-allow-headers");
  responseHeaders.delete("access-control-allow-methods");
  responseHeaders.set("cache-control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
