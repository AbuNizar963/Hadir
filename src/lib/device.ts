/**
 * Device fingerprinting and identification utilities.
 *
 * The MVP stores a stable device id in localStorage so that a given browser
 * profile can be recognized on subsequent visits. In production this should
 * be augmented by server-side signals (IP, UA, TLS fingerprint, etc.).
 */

const DEVICE_ID_KEY = "hadir.deviceId";
const DEVICE_LABEL_KEY = "hadir.deviceLabel";

function generateDeviceId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `dev-${rand}`;
}

/**
 * Returns a stable device identifier for the current browser profile.
 * Creates and persists one on first use.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-side";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return generateDeviceId();
  }
}

/**
 * Returns a human-readable label describing the current device.
 * Uses the persisted label if present, otherwise a short UA snippet.
 */
export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  try {
    const stored = localStorage.getItem(DEVICE_LABEL_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  let label = "جهاز غير معروف";

  if (/iPhone/i.test(ua)) label = "iPhone";
  else if (/iPad/i.test(ua)) label = "iPad";
  else if (/Android/i.test(ua)) label = "Android";
  else if (/Windows/i.test(ua)) label = "Windows PC";
  else if (/Mac OS X|Macintosh/i.test(ua)) label = "Mac";
  else if (/Linux/i.test(ua)) label = "Linux";

  try {
    localStorage.setItem(DEVICE_LABEL_KEY, label);
  } catch {
    /* ignore */
  }
  return label;
}

/**
 * Overrides the persisted human-readable device label.
 */
export function setDeviceLabel(label: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEVICE_LABEL_KEY, label);
  } catch {
    /* ignore */
  }
}

/**
 * Placeholder for the client IP address.
 * The real IP must be captured server-side; the client cannot be trusted.
 */
export function getClientIpPlaceholder(): string {
  return "client-unknown";
}

/* ------------------------------------------------------------------ */
/*  Generic storage adapter (kept for backward compatibility)          */
/* ------------------------------------------------------------------ */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  }

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing from localStorage", e);
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();

export function getStoredJSON<T>(key: string, defaultValue: T): T {
  const val = storage.getItem(key);
  if (!val) return defaultValue;
  try {
    return JSON.parse(val) as T;
  } catch {
    return defaultValue;
  }
}

export function setStoredJSON<T>(key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}
