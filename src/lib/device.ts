/** Device identity helpers for Hadir.
 * The local id is a convenience identifier. The security anchor is the
 * server-side binding plus WebAuthn; FingerprintJS is only a risk signal.
 */
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const DEVICE_ID_KEY = "hadir.device.id";
const DEVICE_LABEL_KEY = "hadir.deviceLabel";
let fingerprintPromise: Promise<string> | null = null;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-side";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)?.trim();
    if (existing) return existing;
    const id = `dev-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch { return `dev-${crypto.randomUUID()}`; }
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (!fingerprintPromise) {
    fingerprintPromise = FingerprintJS.load().then((agent) => agent.get()).then((result) => result.visitorId).catch(() => "");
  }
  return fingerprintPromise;
}

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  try { const stored = localStorage.getItem(DEVICE_LABEL_KEY)?.trim(); if (stored) return stored; } catch {}
  const ua = navigator.userAgent || "";
  const device = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Macintosh|Mac OS X/i.test(ua) ? "Mac" : "متصفح";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "Browser";
  const label = `${device} · ${browser}`;
  try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch {}
  return label;
}
export function setDeviceLabel(label: string): void { try { if (typeof window !== "undefined") localStorage.setItem(DEVICE_LABEL_KEY, label.trim()); } catch {} }

/** Browser-side placeholder. The authoritative client IP is captured by the Worker from the request. */
export function getClientIpPlaceholder(): string { return "browser"; }

export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
class LocalStorageAdapter implements StorageAdapter { getItem(key: string) { try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; } } setItem(key: string, value: string) { try { if (typeof window !== "undefined") localStorage.setItem(key, value); } catch {} } removeItem(key: string) { try { if (typeof window !== "undefined") localStorage.removeItem(key); } catch {} } }
export const storage: StorageAdapter = new LocalStorageAdapter();
export function getStoredJSON<T>(key: string, defaultValue: T): T { const val = storage.getItem(key); if (!val) return defaultValue; try { return JSON.parse(val) as T; } catch { return defaultValue; } }
export function setStoredJSON<T>(key: string, value: T): void { storage.setItem(key, JSON.stringify(value)); }