export type DailyStatusCode = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "NOT_STARTED" | "INVALID";

export type DailyStatusRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string;
  status: DailyStatusCode;
  scheduleType: "ADMIN" | "ROTATION" | string;
  checkInAt: string | null;
  checkOutAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

type DailyStatusResponse = {
  attendanceDay: string;
  timezone: string;
  computedAt: string;
  total: number;
  counts: Record<string, number>;
  employees: DailyStatusRow[];
};

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").trim().replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";

export async function getDailyStatus(day: string): Promise<DailyStatusResponse> {
  const token = typeof window === "undefined" ? "" : localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const headers = new Headers({ "cache-control": "no-cache" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}/api/manager/daily-status?date=${encodeURIComponent(day)}`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `فشل جلب حالة الدوام (${response.status})`);
  return data as DailyStatusResponse;
}
