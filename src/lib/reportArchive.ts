const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const adminHeaders = () => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  return token ? { authorization: `Bearer ${token}` } : {};
};

export async function listArchivedReports(limit = 25) {
  const response = await fetch(`${API_URL}/api/reports/archive?limit=${Math.min(100, Math.max(1, limit))}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { error?: string; archives?: unknown[] } | null;
  if (!response.ok) throw new Error(String(data?.error || `HTTP ${response.status}`));
  if (!data || !Array.isArray(data.archives)) throw new Error("استجابة أرشيف التقارير غير صالحة");
  return data.archives;
}

export function archivedReportUrl(reportId: string) {
  return `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`;
}
