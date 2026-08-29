const PWA_SESSION_COOKIE = "hadir_pwa_session";
const PWA_SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 5;

function isBrowser() { return typeof window !== "undefined" && typeof document !== "undefined"; }

export function persistPwaSession(token: string): void {
  if (!isBrowser() || !token) return;
  document.cookie = `${PWA_SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${PWA_SESSION_MAX_AGE}; Path=/; Secure; SameSite=Lax`;
}

export function clearPwaSession(): void {
  if (!isBrowser()) return;
  document.cookie = `${PWA_SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
}

export function getPwaSessionToken(): string {
  if (!isBrowser()) return "";
  const prefix = `${PWA_SESSION_COOKIE}=`;
  const item = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

/**
 * PWA-only recovery path. The normal HttpOnly hadir_session remains the
 * primary server session. This opaque bearer token is a persistent fallback
 * for installed Chrome PWAs whose storage context can differ from a normal tab.
 */
export async function restorePwaSession(): Promise<any> {
  const token = getPwaSessionToken();
  if (!token) throw new Error("PWA_SESSION_MISSING");
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `PWA_SESSION_INVALID_${response.status}`);
  return data;
}
