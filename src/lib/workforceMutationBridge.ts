const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const installed = Symbol.for("hadir.workforceMutationBridge.v1");

type BridgedFetch = typeof window.fetch & { [installed]?: boolean };

/**
 * LIVE DIRECTORY used to have a second workforce mutation endpoint while the
 * employee editor uses the canonical employee PATCH endpoint. Keep the UI
 * contract stable, but route only the three workforce toggles through the
 * canonical employee persistence path. No GET/POST/other PATCH is changed.
 */
export function installWorkforceMutationBridge() {
  if (typeof window === "undefined") return;
  const current = window.fetch as BridgedFetch;
  if (current[installed]) return;

  const nativeFetch = window.fetch.bind(window);
  const bridgedFetch: BridgedFetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = String(init?.method || request?.method || "GET").toUpperCase();

    if (method !== "PATCH" || !url.startsWith(`${API_URL}/api/workforce/live`)) {
      return nativeFetch(input, init);
    }

    let bodyText: string | undefined;
    try {
      if (typeof init?.body === "string") bodyText = init.body;
      else if (!init?.body && request) bodyText = await request.clone().text();
      else if (init?.body instanceof Blob) bodyText = await init.body.text();
    } catch {
      bodyText = undefined;
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText || "{}") as Record<string, unknown>;
    } catch {
      return nativeFetch(input, init);
    }

    const employeeId = String(body.employeeId || "").trim();
    const patch: Record<string, unknown> = {};
    for (const key of ["isVip", "autoCheckIn", "autoCheckOut"]) {
      if (typeof body[key] === "boolean") patch[key] = body[key];
    }
    if (!employeeId || !Object.keys(patch).length) return nativeFetch(input, init);

    const target = `${API_URL}/api/employees/${encodeURIComponent(employeeId)}`;
    const headers = new Headers(init?.headers || request?.headers || undefined);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");

    return nativeFetch(target, {
      ...init,
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
      credentials: init?.credentials || request?.credentials || "include",
      cache: "no-store",
    });
  };

  Object.defineProperty(bridgedFetch, installed, { value: true, enumerable: false });
  window.fetch = bridgedFetch;
}
