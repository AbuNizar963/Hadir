/** Stable local device identity. FingerprintJS is optional enrichment, never a login dependency. */
const DEVICE_ID_KEY = "hadir.deviceId";
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
 * Returns immediately. The employee login must never wait for a third-party
 * fingerprint CDN. FingerprintJS, when available, is only an optional
 * secondary identifier and is not required for attendance.
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

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  let label = "متصفح الهاتف";
  if (/iPhone/i.test(ua)) label = "iPhone";
  else if (/iPad/i.test(ua)) label = "iPad";
  else if (/Android/i.test(ua)) label = "Android";
  else if (/Windows/i.test(ua)) label = "Windows PC";
  else if (/Mac OS X|Macintosh/i.test(ua)) label = "Mac";
  else if (/Linux/i.test(ua)) label = "Linux";

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
