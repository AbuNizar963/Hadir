const API_URL = String(
  import.meta.env.VITE_API_URL ||
    "https://hadir-api.abunizar963.workers.dev",
).replace(/\/$/, "");

type ArchiveListResponse = {
  error?: string;
  archives?: unknown[];
  reports?: unknown[];
};

const adminHeaders = (): Record<string, string> => {
  const token =
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("hadir.api.token.admin") || "";

  return token ? { authorization: `Bearer ${token}` } : {};
};

function archiveRows(data: ArchiveListResponse | unknown): unknown[] | null {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as ArchiveListResponse;

  if (Array.isArray(payload.archives)) {
    return payload.archives;
  }

  // Keep compatibility with older API deployments that returned "reports".
  if (Array.isArray(payload.reports)) {
    return payload.reports;
  }

  return null;
}

export async function listArchivedReports(limit = 25) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const response = await fetch(
    `${API_URL}/api/reports/archive?limit=${safeLimit}`,
    {
      headers: adminHeaders(),
      credentials: "include",
      cache: "no-store",
    },
  );

  const data = (await response
    .json()
    .catch(() => null)) as ArchiveListResponse | unknown;

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `HTTP ${response.status}`;

    throw new Error(message);
  }

  const rows = archiveRows(data);

  if (!rows) {
    throw new Error("استجابة أرشيف التقارير غير صالحة");
  }

  return rows;
}

export async function refreshReportArchive() {
  const response = await fetch(`${API_URL}/api/reports/archive/refresh`, {
    method: "POST",
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });

  const data = (await response
    .json()
    .catch(() => null)) as { error?: string; archived?: boolean } | null;

  if (!response.ok) {
    throw new Error(
      String(data?.error || `HTTP ${response.status}`),
    );
  }

  return data;
}

export async function downloadArchivedReport(
  reportId: string,
  fileName: string,
) {
  const response = await fetch(
    `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`,
    {
      headers: adminHeaders(),
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as { error?: string } | null;

    throw new Error(
      String(data?.error || `HTTP ${response.status}`),
    );
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
  const response = await fetch(
    `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(),
      credentials: "include",
      cache: "no-store",
    },
  );

  const data = (await response
    .json()
    .catch(() => null)) as { error?: string; deleted?: boolean } | null;

  if (!response.ok || !data?.deleted) {
    throw new Error(
      String(data?.error || `HTTP ${response.status}`),
    );
  }

  return data;
}

export function archivedReportUrl(reportId: string) {
  return `${API_URL}/api/reports/archive/${encodeURIComponent(reportId)}`;
}