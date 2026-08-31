const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
export function employeeAvatarUrl(value: string | null | undefined, employeeId: string): string | null {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}/api/employees/${encodeURIComponent(employeeId)}/avatar`;
}
