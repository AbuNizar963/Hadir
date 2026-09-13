import { getBackendEscapeEvents } from "@/lib/backend";

export type DailyStatusCode =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "REST"
  | "LEAVE"
  | "PERMISSION"
  | "ESCAPED"
  | "NOT_STARTED"
  | "INVALID"
  | "OPEN";

export type DailyStatusRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string;
  status: DailyStatusCode;
  statusLabel: string;
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

type EscapeState = {
  employeeId?: string;
  status?: string;
};

const ESCAPED_STATUS = "ESCAPED" as const;
const API_URL = "https://hadir-api.abunizar963.workers.dev";
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";

function normalizeActiveAttendance(
  data: DailyStatusResponse,
  escapedEmployeeIds: ReadonlySet<string> = new Set(),
): DailyStatusResponse {
  const employees = Array.isArray(data.employees)
    ? data.employees.map((row) => {
        if (escapedEmployeeIds.has(String(row.employeeId))) {
          return {
            ...row,
            status: ESCAPED_STATUS,
            statusLabel: "انصراف دون إذن",
          };
        }

        if (row.status === "OPEN") {
          return {
            ...row,
            status: "PRESENT" as const,
            statusLabel: "حاضر",
          };
        }

        return row;
      })
    : [];

  const counts = employees.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ...data,
    total: employees.length,
    employees,
    counts,
  };
}

// Escape is a current employee state, so the latest event takes precedence over the daily snapshot.
async function getCurrentEscapedEmployeeIds(): Promise<Set<string>> {
  try {
    const events = (await getBackendEscapeEvents(undefined, 2000)) as EscapeState[];
    const latestByEmployee = new Map<string, string>();

    for (const event of events) {
      const employeeId = String(event.employeeId || "").trim();
      if (!employeeId || latestByEmployee.has(employeeId)) continue;
      latestByEmployee.set(employeeId, String(event.status || "").trim().toLowerCase());
    }

    return new Set(
      [...latestByEmployee.entries()]
        .filter(([, status]) => status === "escaped")
        .map(([employeeId]) => employeeId),
    );
  } catch {
    // daily-status remains usable for roles that cannot read the manager escape feed.
    return new Set();
  }
}

export async function getDailyStatus(day: string): Promise<DailyStatusResponse> {
  const token =
    typeof window === "undefined"
      ? ""
      : localStorage.getItem(ADMIN_TOKEN_KEY) ||
        localStorage.getItem(EMPLOYEE_TOKEN_KEY) ||
        "";
  const headers = new Headers();

  if (token) headers.set("authorization", `Bearer ${token}`);

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}/api/manager/daily-status?date=${encodeURIComponent(day)}`,
      {
        method: "GET",
        headers,
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
      },
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `تعذر الاتصال بخادم حاضر: ${error.message}`
        : "تعذر الاتصال بخادم حاضر",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `فشل جلب حالة الدوام (${response.status})`,
    );
  }

  const escapedEmployeeIds = await getCurrentEscapedEmployeeIds();
  return normalizeActiveAttendance(
    data as DailyStatusResponse,
    escapedEmployeeIds,
  );
}
