const API_ORIGIN = "https://hadir-api.abunizar963.workers.dev";
const GITHUB_RELEASES_API = "https://api.github.com/repos/AbuNizar963/Hadir/releases/latest";
const GITHUB_ASSET_NAME = "app-release-signed.apk";

function upstreamUrl(request: Request, path?: string): URL {
  const suffix = String(path || "").replace(/^\/+/, "");
  const url = new URL(`${API_ORIGIN}/api/${suffix}`);
  url.search = new URL(request.url).search;
  return url;
}

async function latestApkProxy(): Promise<Response> {
  const releaseResponse = await fetch(GITHUB_RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Hadir-Cloudflare-Update-Proxy",
      "Cache-Control": "no-cache",
    },
  });
  if (!releaseResponse.ok) {
    return new Response("تعذر الوصول إلى معلومات تحديث HADIR", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const release = await releaseResponse.json() as any;
  if (release?.draft || release?.prerelease) {
    return new Response("لا يوجد إصدار تحديث صالح", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const asset = Array.isArray(release?.assets)
    ? release.assets.find((item: any) => item?.name === GITHUB_ASSET_NAME)
    : null;
  const downloadUrl = String(asset?.browser_download_url || "").trim();
  if (!downloadUrl) {
    return new Response("ملف تحديث HADIR غير متوفر", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const apkResponse = await fetch(downloadUrl, {
    headers: { "User-Agent": "Hadir-Cloudflare-Update-Proxy" },
    redirect: "follow",
  });
  if (!apkResponse.ok || !apkResponse.body) {
    return new Response("تعذر تنزيل ملف تحديث HADIR", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(apkResponse.headers);
  headers.set("content-type", "application/vnd.android.package-archive");
  headers.set("cache-control", "no-store");
  headers.delete("content-encoding");
  return new Response(apkResponse.body, {
    status: 200,
    headers,
  });
}

export async function onRequest(context: any): Promise<Response> {
  const { request, params } = context;
  const path = Array.isArray(params?.path) ? params.path.join("/") : String(params?.path || "");

  if (request.method === "GET" && path === "mobile/update/apk") {
    return latestApkProxy();
  }

  const target = upstreamUrl(request, path);
  const headers = new Headers(request.headers);

  // The browser talks to Pages itself. Preserve authentication/device headers
  // while making the upstream request identify the public Pages origin.
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
