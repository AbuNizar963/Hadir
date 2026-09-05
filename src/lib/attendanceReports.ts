import { backendEnabled } from "@/lib/backend";

export type AttendanceReportRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string;
  status: string;
  scheduleType: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  expectedMinutes: number | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  open: boolean;
  exceptionCode: string | null;
  attendanceEventIds: string[];
  attendanceEventCount: number;
  attendanceEvents: Array<Record<string, unknown>>;
  calculationSource: string;
  calculationVersion: string;
  timezone: string;
};

export type AttendanceReport = {
  ok: true;
  reportVersion: string;
  generatedAt: string;
  timezone: string;
  from: string;
  to: string;
  days: number;
  filters: { employeeId: string | null };
  summary: {
    employees: number;
    employeeDays: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
    permission: number;
    rest: number;
    notStarted: number;
    invalid: number;
    open: number;
    missingCheckIn: number;
    missingCheckOut: number;
    workedMinutes: number;
    expectedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    attendanceRate: number;
    punctualityRate: number;
  };
  analytics: {
    dailySeries: Array<{
      attendanceDay: string;
      present: number;
      late: number;
      absent: number;
      leave: number;
      permission: number;
      rest: number;
      open: number;
      lateMinutes: number;
      workedMinutes: number;
      expectedMinutes: number;
      overtimeMinutes: number;
    }>;
    employeeSummaries: Array<{
      employeeId: string;
      employeeName: string;
      jobNumber: string;
      days: number;
      present: number;
      late: number;
      absent: number;
      leave: number;
      permission: number;
      open: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      overtimeMinutes: number;
      workedMinutes: number;
      expectedMinutes: number;
    }>;
    exceptions: Array<{
      attendanceDay: string;
      employeeId: string;
      employeeName: string;
      jobNumber: string;
      code: string;
      status: string;
      minutes: number;
      attendanceEventIds: string[];
    }>;
    exceptionCounts: Record<string, number>;
  };
  rows: AttendanceReportRow[];
  integrity: {
    sourceOfTruth: string;
    derivedStatus: string;
    noRawAttendanceMutation: boolean;
    periodScoped: boolean;
    maxDays: number;
    drillDownAvailable: boolean;
    rawEventIdsIncluded: boolean;
  };
};

function token(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("hadir.api.token.admin") || "";
}

export async function getAttendanceReport(from: string, to: string, employeeId?: string): Promise<AttendanceReport> {
  if (!backendEnabled) throw new Error("نظام التقارير الخلفي غير مفعّل.");
  const params = new URLSearchParams({ from, to });
  if (employeeId) params.set("employeeId", employeeId);
  const headers = new Headers({ "content-type": "application/json" });
  const authToken = token();
  if (authToken) headers.set("authorization", `Bearer ${authToken}`);
  const response = await fetch(`https://hadir-api.abunizar963.workers.dev/api/reports/attendance?${params.toString()}`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `فشل تحميل التقرير (${response.status})`);
  return data as AttendanceReport;
}
