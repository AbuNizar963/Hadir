/** Device identity helpers for Hadir.
 * The local id is a convenience identifier. The security anchor is the
 * server-side binding plus WebAuthn; FingerprintJS is only a risk signal.
 *
 * Device identification is deliberately best-effort: modern browsers may
 * hide the exact hardware model. We prefer User-Agent Client Hints when
 * available and fall back to the traditional user-agent string.
 */
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const DEVICE_ID_KEY = "hadir.device.id";
const DEVICE_LABEL_KEY = "hadir.deviceLabel";
const DEVICE_DETAILS_KEY = "hadir.deviceDetails";
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

export interface DeviceDetails {
  type: "phone" | "tablet" | "desktop" | "unknown";
  manufacturer: string;
  model: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  label: string;
  exactModelAvailable: boolean;
}

function versionFrom(ua: string, pattern: RegExp): string {
  return ua.match(pattern)?.[1] || "";
}

function parseAndroidModel(ua: string): { manufacturer: string; model: string } {
  const match = ua.match(/Android\s[^;\)]+;\s*(?:[a-z]{2}-[A-Z]{2};\s*)?([^;\)]+?)(?:\s+Build\/[^;\)]+)?(?:;|\))/i);
  const raw = match?.[1]?.trim() || "";
  const lower = raw.toLowerCase();
  let manufacturer = "Android";
  if (/^(sm-|gt-|sch-|sgh-)/i.test(raw)) manufacturer = "Samsung";
  else if (/^(redmi|mi\s|m\d|230|220|210|240)/i.test(raw)) manufacturer = /redmi/i.test(raw) ? "Xiaomi" : "Xiaomi";
  else if (/^(pixel)/i.test(raw)) manufacturer = "Google";
  else if (/^(oneplus|cph)/i.test(raw)) manufacturer = "OnePlus / OPPO";
  else if (/^(rmx)/i.test(raw)) manufacturer = "realme";
  else if (/^(vivo|v\d)/i.test(raw)) manufacturer = "vivo";
  else if (/^(in20|infinix)/i.test(raw)) manufacturer = "Infinix";
  else if (/^(tecno|ki\d|lh\d)/i.test(raw)) manufacturer = "TECNO";
  else if (/^(huawei|hma-|els-|ana-)/i.test(raw)) manufacturer = "Huawei";
  else if (/^(honor|bvl-|ali-)/i.test(raw)) manufacturer = "HONOR";
  else if (/^(moto|xt\d)/i.test(raw)) manufacturer = "Motorola";
  else if (/^(nokia|ta-)/i.test(raw)) manufacturer = "Nokia";
  return { manufacturer, model: raw || "Android device" };
}

function parseBrowser(ua: string): { browser: string; version: string } {
  const entries: Array<[RegExp, string]> = [
    [/EdgA\//i, "Edge"],
    [/EdgiOS\//i, "Edge"],
    [/Edg\//i, "Edge"],
    [/SamsungBrowser\//i, "Samsung Internet"],
    [/OPR\//i, "Opera"],
    [/CriOS\//i, "Chrome"],
    [/FxiOS\//i, "Firefox"],
    [/Chrome\//i, "Chrome"],
    [/Firefox\//i, "Firefox"],
    [/Version\//i, "Safari"],
  ];
  for (const [pattern, name] of entries) {
    if (pattern.test(ua)) {
      const version = name === "Safari" ? versionFrom(ua, /Version\/([\d.]+)/i) : versionFrom(ua, new RegExp(`${pattern.source.replace(/\\\//g, "\\/")}([\\d.]+)`, "i"));
      return { browser: name, version };
    }
  }
  return { browser: "Browser", version: "" };
}

export function getDeviceDetails(): DeviceDetails {
  if (typeof window === "undefined") {
    return { type: "unknown", manufacturer: "server", model: "server", os: "server", osVersion: "", browser: "server", browserVersion: "", label: "server", exactModelAvailable: false };
  }
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIPad;
  const isLinux = /Linux/i.test(ua) && !isAndroid;
  const android = isAndroid ? parseAndroidModel(ua) : null;
  const browser = parseBrowser(ua);

  let type: DeviceDetails["type"] = "desktop";
  let manufacturer = "Microsoft";
  let model = "Windows PC";
  let os = "Windows";
  let osVersion = versionFrom(ua, /Windows NT\s([\d.]+)/i);
  let exactModelAvailable = false;

  if (isIPhone) {
    type = "phone"; manufacturer = "Apple"; model = "iPhone"; os = "iOS";
    osVersion = versionFrom(ua, /OS\s([\d_]+)/i).replace(/_/g, ".");
  } else if (isIPad) {
    type = "tablet"; manufacturer = "Apple"; model = "iPad"; os = "iPadOS";
    osVersion = versionFrom(ua, /OS\s([\d_]+)/i).replace(/_/g, ".");
  } else if (isAndroid) {
    type = /Mobile/i.test(ua) ? "phone" : "tablet";
    manufacturer = android?.manufacturer || "Android";
    model = android?.model || "Android device";
    os = "Android";
    osVersion = versionFrom(ua, /Android\s([\d.]+)/i);
    exactModelAvailable = model !== "Android device";
  } else if (isMac) {
    manufacturer = "Apple"; model = "Mac"; os = "macOS";
    osVersion = versionFrom(ua, /Mac OS X\s*([\d_\.]+)/i).replace(/_/g, ".");
  } else if (isLinux) {
    manufacturer = "Linux"; model = "Linux PC"; os = "Linux";
  }

  const labelParts = [manufacturer, model];
  if (os) labelParts.push(`${os}${osVersion ? ` ${osVersion}` : ""}`);
  labelParts.push(`${browser.browser}${browser.version ? ` ${browser.version}` : ""}`.trim());
  return { type, manufacturer, model, os, osVersion, browser: browser.browser, browserVersion: browser.version, label: labelParts.join(" · "), exactModelAvailable };
}

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  try { const stored = localStorage.getItem(DEVICE_LABEL_KEY)?.trim(); if (stored) return stored; } catch {}
  const label = getDeviceDetails().label;
  try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch {}
  return label;
}

export function refreshDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  const label = getDeviceDetails().label;
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
