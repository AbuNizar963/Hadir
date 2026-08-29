/** Device identity helpers for Hadir. */
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
  if (!fingerprintPromise) fingerprintPromise = FingerprintJS.load().then((agent) => agent.get()).then((result) => result.visitorId).catch(() => "");
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

function versionFrom(ua: string, pattern: RegExp): string { return ua.match(pattern)?.[1] || ""; }

function parseAndroidModel(ua: string): { manufacturer: string; model: string } {
  const match = ua.match(/Android\s[^;\)]+;\s*(?:[a-z]{2}-[A-Z]{2};\s*)?([^;\)]+?)(?:\s+Build\/[^;\)]+)?(?:;|\))/i);
  const raw = match?.[1]?.trim() || "";
  let manufacturer = "Android";
  if (/^(SM-|GT-|SCH-|SGH-)/i.test(raw)) manufacturer = "Samsung";
  else if (/^(Redmi|Mi\s|M\d|230|220|210|240)/i.test(raw)) manufacturer = "Xiaomi";
  else if (/^(Pixel)/i.test(raw)) manufacturer = "Google";
  else if (/^(OnePlus|CPH)/i.test(raw)) manufacturer = "OnePlus / OPPO";
  else if (/^(RMX)/i.test(raw)) manufacturer = "realme";
  else if (/^(Vivo|V\d)/i.test(raw)) manufacturer = "vivo";
  else if (/^(Infinix|X\d)/i.test(raw)) manufacturer = "Infinix";
  else if (/^(TECNO|KI\d|LH\d)/i.test(raw)) manufacturer = "TECNO";
  else if (/^(Huawei|HMA-|ELS-|ANA-)/i.test(raw)) manufacturer = "Huawei";
  else if (/^(Honor|BVL-|ALI-)/i.test(raw)) manufacturer = "HONOR";
  else if (/^(Moto|XT\d)/i.test(raw)) manufacturer = "Motorola";
  else if (/^(Nokia|TA-)/i.test(raw)) manufacturer = "Nokia";
  return { manufacturer, model: raw || "Android device" };
}

function parseBrowser(ua: string): { browser: string; version: string } {
  const entries: Array<[RegExp, string, RegExp]> = [
    [/EdgA\//i, "Edge", /EdgA\/([\d.]+)/i], [/EdgiOS\//i, "Edge", /EdgiOS\/([\d.]+)/i],
    [/Edg\//i, "Edge", /Edg\/([\d.]+)/i], [/SamsungBrowser\//i, "Samsung Internet", /SamsungBrowser\/([\d.]+)/i],
    [/OPR\//i, "Opera", /OPR\/([\d.]+)/i], [/CriOS\//i, "Chrome", /CriOS\/([\d.]+)/i],
    [/FxiOS\//i, "Firefox", /FxiOS\/([\d.]+)/i], [/Chrome\//i, "Chrome", /Chrome\/([\d.]+)/i],
    [/Firefox\//i, "Firefox", /Firefox\/([\d.]+)/i], [/Version\//i, "Safari", /Version\/([\d.]+)/i],
  ];
  for (const [pattern, name, versionPattern] of entries) if (pattern.test(ua)) return { browser: name, version: versionFrom(ua, versionPattern) };
  return { browser: "Browser", version: "" };
}

function buildDeviceDetails(ua: string, hints?: { model?: string; platform?: string; platformVersion?: string; mobile?: boolean; formFactors?: string[] }): DeviceDetails {
  const isAndroid = /Android/i.test(ua) || hints?.platform === "Android";
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isWindows = /Windows/i.test(ua) || hints?.platform === "Windows";
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIPad || hints?.platform === "macOS";
  const isLinux = /Linux/i.test(ua) && !isAndroid || hints?.platform === "Linux";
  const android = isAndroid ? parseAndroidModel(ua) : null;
  const browser = parseBrowser(ua);
  const hintModel = String(hints?.model || "").trim();
  let type: DeviceDetails["type"] = "desktop";
  let manufacturer = isWindows ? "Microsoft" : "Unknown";
  let model = isWindows ? "Windows PC" : "Computer";
  let os = isWindows ? "Windows" : "Unknown";
  let osVersion = versionFrom(ua, /Windows NT\s([\d.]+)/i);
  if (isIPhone) { type = "phone"; manufacturer = "Apple"; model = "iPhone"; os = "iOS"; osVersion = versionFrom(ua, /OS\s([\d_]+)/i).replace(/_/g, "."); }
  else if (isIPad) { type = "tablet"; manufacturer = "Apple"; model = "iPad"; os = "iPadOS"; osVersion = versionFrom(ua, /OS\s([\d_]+)/i).replace(/_/g, "."); }
  else if (isAndroid) {
    type = hints?.mobile || /Mobile/i.test(ua) ? "phone" : "tablet";
    manufacturer = android?.manufacturer || "Android";
    model = hintModel || android?.model || "Android device";
    os = "Android";
    osVersion = hints?.platformVersion || versionFrom(ua, /Android\s([\d.]+)/i);
  } else if (isMac) { manufacturer = "Apple"; model = "Mac"; os = "macOS"; osVersion = hints?.platformVersion || versionFrom(ua, /Mac OS X\s*([\d_\.]+)/i).replace(/_/g, "."); }
  else if (isLinux) { manufacturer = "Linux"; model = "Linux PC"; os = "Linux"; osVersion = hints?.platformVersion || ""; }
  const exactModelAvailable = Boolean(hintModel) || (isAndroid && model !== "Android device") || isIPhone || isIPad;
  const label = [manufacturer, model, `${os}${osVersion ? ` ${osVersion}` : ""}`, `${browser.browser}${browser.version ? ` ${browser.version}` : ""}`.trim()].join(" · ");
  return { type, manufacturer, model, os, osVersion, browser: browser.browser, browserVersion: browser.version, label, exactModelAvailable };
}

export function getDeviceDetails(): DeviceDetails {
  if (typeof window === "undefined") return { type: "unknown", manufacturer: "server", model: "server", os: "server", osVersion: "", browser: "server", browserVersion: "", label: "server", exactModelAvailable: false };
  return buildDeviceDetails(navigator.userAgent || "");
}

/** Modern model lookup using User-Agent Client Hints. Browsers may decline high-entropy model data for privacy. */
export async function getDeviceDetailsAsync(): Promise<DeviceDetails> {
  if (typeof window === "undefined") return getDeviceDetails();
  const base = getDeviceDetails();
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string; getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string; platformVersion?: string; mobile?: boolean; formFactors?: string[] }> } }).userAgentData;
  if (!uaData?.getHighEntropyValues) return base;
  try {
    const hints = await uaData.getHighEntropyValues(["model", "platform", "platformVersion", "formFactors"]);
    return buildDeviceDetails(navigator.userAgent || "", hints);
  } catch { return base; }
}

export async function getDeviceLabelAsync(): Promise<string> {
  const details = await getDeviceDetailsAsync();
  const label = details.label;
  try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch {}
  return label;
}

export function getDeviceTypeLabel(type: DeviceDetails["type"]): string {
  return type === "phone" ? "هاتف" : type === "tablet" ? "جهاز لوحي" : type === "desktop" ? "حاسوب" : "جهاز";
}

export function getDeviceTypeIcon(type: DeviceDetails["type"]): string {
  return type === "phone" ? "📱" : type === "tablet" ? "▣" : type === "desktop" ? "🖥️" : "◉";
}

/** Uses the latest asynchronously resolved label when available, otherwise falls back to synchronous detection. */
export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "server";
  try {
    const cached = localStorage.getItem(DEVICE_LABEL_KEY)?.trim();
    if (cached && !/^(Android|Unknown|Computer)\s·/.test(cached)) return cached;
  } catch {}
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
export function getClientIpPlaceholder(): string { return "browser"; }
export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
class LocalStorageAdapter implements StorageAdapter { getItem(key: string) { try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; } } setItem(key: string, value: string) { try { if (typeof window !== "undefined") localStorage.setItem(key, value); } catch {} } removeItem(key: string) { try { if (typeof window !== "undefined") localStorage.removeItem(key); } catch {} } }
export const storage: StorageAdapter = new LocalStorageAdapter();
export function getStoredJSON<T>(key: string, defaultValue: T): T { const val = storage.getItem(key); if (!val) return defaultValue; try { return JSON.parse(val) as T; } catch { return defaultValue; } }
export function setStoredJSON<T>(key: string, value: T): void { storage.setItem(key, JSON.stringify(value)); }
