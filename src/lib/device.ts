/**
 * Browser/device identity used by Hadir employee authentication.
 *
 * Browsers intentionally do not expose IMEI, serial number, or other
 * hardware identifiers to normal web applications. We therefore use a
 * cryptographically random browser identity stored locally and combine it
 * with a human-readable browser/device label. The server stores the random
 * identity in D1 and enforces the binding; clearing browser storage or using
 * another browser creates a different identity and requires an admin reset.
 */
const DEVICE_ID_KEY = "hadir.device.id";
const DEVICE_LABEL_KEY = "hadir.deviceLabel";
const FINGERPRINT_KEY = "hadir.fingerprintId";

function generateDeviceId(): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `dev-${rand}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-side";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)?.trim();
    if (existing) return existing;
    const id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return generateDeviceId();
  }
}

/**
 * Kept as a compatibility API. The binding identity itself is the random
 * browser credential above; we do not make login depend on a third-party
 * fingerprinting CDN.
 */
export async function getPersistentFingerprintId(): Promise<string> {
  const deviceId = getDeviceId();
  try {
    const cached = localStorage.getItem(FINGERPRINT_KEY)?.trim();
    if (cached) return cached;
  } catch {}
  return deviceId;
}

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  try {
    const stored = localStorage.getItem(DEVICE_LABEL_KEY)?.trim();
    if (stored) return stored;
  } catch {}

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const ua = nav?.userAgent || "";
  const platform = nav?.platform || "";
  let device = "متصفح الهاتف";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Windows/i.test(ua) || /Win/i.test(platform)) device = "Windows PC";
  else if (/Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform)) device = "Mac";
  else if (/Linux/i.test(ua)) device = "Linux";

  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
          ? "Safari"
          : "Browser";
  const label = `${device} · ${browser}`;

  try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch {}
  return label;
}

export function setDeviceLabel(label: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DEVICE_LABEL_KEY, label.trim() || "متصفح الهاتف"); } catch {}
}

export function getClientIpPlaceholder(): string { return "client-unknown"; }

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string) { if (typeof window === "undefined") return null; try { return localStorage.getItem(key); } catch { return null; } }
  setItem(key: string, value: string) { if (typeof window === "undefined") return; try { localStorage.setItem(key, value); } catch {} }
  removeItem(key: string) { if (typeof window === "undefined") return; try { localStorage.removeItem(key); } catch {} }
}

export const storage: StorageAdapter = new LocalStorageAdapter();
export function getStoredJSON<T>(key: string, defaultValue: T): T {
  const val = storage.getItem(key);
  if (!val) return defaultValue;
  try { return JSON.parse(val) as T; } catch { return defaultValue; }
}
export function setStoredJSON<T>(key: string, value: T): void { storage.setItem(key, JSON.stringify(value)); }
