export const DEFAULT_SYSTEM_TIME_ZONE = "Asia/Damascus";

export function isValidSystemTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function parseSystemTimeZoneSetting(
  value: unknown,
  fallback = DEFAULT_SYSTEM_TIME_ZONE,
): string {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      // Older/manual settings may be stored as a raw string rather than JSON.
    }
  }
  return isValidSystemTimeZone(candidate) ? candidate : fallback;
}

export async function getConfiguredSystemTimeZone(
  db: D1Database,
  fallback = DEFAULT_SYSTEM_TIME_ZONE,
): Promise<string> {
  try {
    const row = await db
      .prepare("SELECT value FROM settings WHERE key='timezone' LIMIT 1")
      .first<{ value: string }>();
    return parseSystemTimeZoneSetting(row?.value, fallback);
  } catch {
    return fallback;
  }
}
