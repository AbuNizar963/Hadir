const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const adminHeaders = () => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  return token ? { authorization: `Bearer ${token}` } : {};
};

export type ReportArchiveUpload = {
  file: Blob;
  fileName: string;
  reportType: "attendance_daily" | "attendance_period" | "attendance_employee";
  periodFrom: string;
  periodTo: string;
  employeeId?: string;
  generatedAt: string;
  reportVersion: string;
  dataSnapshotHash: string;
};

export async function archiveReportFile(input: ReportArchiveUpload) {
  const form = new FormData();
  form.set("file", input.file, input.fileName);
  form.set("fileName", input.fileName);
  form.set("reportType", input.reportType);
  form.set("periodFrom", input.periodFrom);
  form.set("periodTo", input.periodTo);
  if (input.employeeId) form.set("employeeId", input.employeeId);
  form.set("generatedAt", input.generatedAt);
  form.set("reportVersion", input.reportVersion);
  form.set("dataSnapshotHash", input.dataSnapshotHash);

  const response = await fetch(`${API_URL}/api/reports/archive`, {
    method: "POST",
    headers: adminHeaders(),
    credentials: "include",
    body: form,
  });
  const data = await response.json().catch(() => null) as { error?: string; report?: unknown } | null;
  if (!response.ok) throw new Error(String(data?.error || `HTTP ${response.status}`));
  return data;
}

export async function listArchivedReports(limit = 25) {
  const response = await fetch(`${API_URL}/api/reports/archive?limit=${Math.min(100, Math.max(1, limit))}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { error?: string; reports?: unknown[] } | null;
  if (!response.ok) throw new Error(String(data?.error || `HTTP ${response.status}`));
  return data?.reports || [];
}

export function archivedReportUrl(reportId: string) {
  return `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`;
}
