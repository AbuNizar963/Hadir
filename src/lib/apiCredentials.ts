const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

let installed = false;

export function installApiCredentials(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let url = "";
    try {
      url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    } catch {
      return nativeFetch(input, init);
    }

    if (!url.startsWith(API_URL)) return nativeFetch(input, init);

    // Preserve the caller's explicit credential policy. This is important for
    // token-authenticated endpoints such as daily-status, which must use
    // credentials: "omit" rather than sending cookies cross-origin.
    if (init && Object.prototype.hasOwnProperty.call(init, "credentials")) {
      return nativeFetch(input, init);
    }

    return nativeFetch(input, { ...init, credentials: "include" });
  }) as typeof window.fetch;
}
