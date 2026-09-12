const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const adminHeaders = () => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  return token ? { authorization: `Bearer ${token}` } : {};
};

export async function listArchivedReports(limit = 25) {
  const response = await fetch(`${API_URL}/api/reports/archive?limit=${Math.min(100, Math.max(1, limit))}`, {
    headers: adminHeaders(), credentials: "include", cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { error?: string; archives?: unknown[] } | null;
  if (!response.ok) throw new Error(String(data?.error || `HTTP ${response.status}`));
  if (!data || !Array.isArray(data.archives)) throw new Error("استجابة أرشيف التقارير غير صالحة");
  return data.archives;
}

export async function downloadArchivedReport(reportId: string, fileName: string) {
  const response = await fetch(`${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`, {
    headers: adminHeaders(), credentials: "include", cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(String(data?.error || `HTTP ${response.status}`));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || "report.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function deleteArchivedReport(reportId: string) {
  const response = await fetch(`${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`, {
    method: "DELETE", headers: adminHeaders(), credentials: "include", cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { error?: string; deleted?: boolean } | null;
  if (!response.ok || !data?.deleted) throw new Error(String(data?.error || `HTTP ${response.status}`));
  return data;
}

export function archivedReportUrl(reportId: string) {
  return `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`;
}
