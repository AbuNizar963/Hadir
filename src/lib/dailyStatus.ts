export type DailyStatusCode = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "PERMISSION" | "NOT_STARTED" | "INVALID" | "OPEN";

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

const API_URL = "https://hadir-api.abunizar963.workers.dev";
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";

export async function getDailyStatus(day: string): Promise<DailyStatusResponse> {
  const token = typeof window === "undefined" ? "" : localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/manager/daily-status?date=${encodeURIComponent(day)}`, {
      method: "GET",
      headers,
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
    });
  } catch (error) {
    throw new Error(error instanceof Error ? `تعذر الاتصال بخادم حاضر: ${error.message}` : "تعذر الاتصال بخادم حاضر");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `فشل جلب حالة الدوام (${response.status})`);
  return data as DailyStatusResponse;
}
