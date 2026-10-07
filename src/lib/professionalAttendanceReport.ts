export type ProfessionalAttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "PERMISSION" | "ESCAPED" | "NOT_STARTED" | "INVALID" | "HOLIDAY";

export type ProfessionalAttendanceRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string | null;
  locationId: string | null;
  status: ProfessionalAttendanceStatus;
  attendanceSource: "AUTOMATIC_VIP" | "AUTOMATIC" | "MANUAL_OWNER" | "MANUAL_EMPLOYEE" | "MIXED" | "UNKNOWN";
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
  notes: string;
  attendanceEventIds: string[];
  requestIds: string[];
  auditIds: string[];
  calculationSource: string;
  calculationVersion: string;
  historicalDataQuality: string;
  timezone: string;
  computedAt: string;
};

export type ProfessionalAttendanceReport = {
  ok: boolean;
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
    escaped: number;
    notStarted: number;
    invalid: number;
    open: number;
    workedMinutes: number;
    expectedMinutes: number;
    workVarianceMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    attendanceRate: number;
    punctualityRate: number;
  };
  analytics: {
    dailySeries: Array<{ attendanceDay: string; present: number; late: number; absent: number; leave: number; permission: number; rest: number; escaped: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>;
    employeeSummaries: Array<{ employeeId: string; employeeName: string; jobNumber: string | null; days: number; present: number; late: number; absent: number; leave: number; permission: number; rest: number; escaped: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>;
    exceptionCounts: Record<string, number>;
    attendanceSourceCounts: Record<string, number>;
    exceptions: Array<{ attendanceDay: string; employeeId: string; employeeName: string; jobNumber: string | null; code: string; status: ProfessionalAttendanceStatus; attendanceSource: ProfessionalAttendanceRow["attendanceSource"]; minutes: number; attendanceEventIds: string[]; requestIds: string[]; auditIds: string[] }>;
  };
  rows: ProfessionalAttendanceRow[];
  dataQuality: { byStatus: Partial<Record<ProfessionalAttendanceStatus, number>>; complete: boolean };
  integrity: { sourceOfTruth: string; rawSource: string; noRawAttendanceMutation: boolean; periodScoped: boolean; maxDays: number; drillDownAvailable: boolean; sourceEventIdsIncluded: boolean; requestIdsIncluded: boolean; auditIdsIncluded: boolean; attendanceSourceDerivedFromRawEvents: boolean };
};

export type ProfessionalAttendanceDrilldown = {
  ok: boolean;
  attendanceDay: string;
  employeeId: string;
  fact: {
    attendanceDay: string;
    employeeId: string;
    employeeName: string;
    jobNumber: string | null;
    locationId: string | null;
    status: ProfessionalAttendanceStatus;
    attendanceSource: ProfessionalAttendanceRow["attendanceSource"];
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
    calculationSource: string;
    calculationVersion: string;
    historicalDataQuality: string;
    dataQualityReason: string | null;
    timezone: string;
    computedAt: string;
    scheduleSnapshot: Record<string, unknown>;
  };
  sources: {
    attendance: Record<string, unknown>[];
    requests: Record<string, unknown>[];
    audit: Record<string, unknown>[];
  };
  trace: {
    attendanceEventIds: string[];
    requestIds: string[];
    auditIds: string[];
    sourceOfTruth: string;
    rawSource: string;
    readOnly: boolean;
    noRawAttendanceMutation: boolean;
  };
};

type AttendanceCenterResponse = {
  ok: boolean;
  centerVersion: string;
  timezone: string;
  date: string;
  from: string;
  to: string;
  attendance: Record<string, unknown>;
  report: ProfessionalAttendanceReport;
  integrity: {
    readOnly: boolean;
    noRawAttendanceMutation: boolean;
    attendanceSource: string;
    historicalReportSource: string;
  };
};

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const adminHeaders = () => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
};

function responseError(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("error" in data)) return null;
  return typeof data.error === "string" ? data.error : null;
}

// The report client deliberately accepts the server's reportable row set as-is.
// Employee/day eligibility is owned by the authoritative reporting engine;
// the browser must not independently add, remove, or reinterpret report rows.
export async function getProfessionalAttendanceReport(from: string, to: string, employeeId?: string) {
  const query = new URLSearchParams({ date: to, from, to });
  if (employeeId) query.set("employeeId", employeeId);
  const response = await fetch(`${API_URL}/api/manager/attendance-center?${query.toString()}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(responseError(data) || `HTTP ${response.status}`);
  if (!data || typeof data !== "object" || !("report" in data)) throw new Error("استجابة مركز التقرير غير صالحة");
  const report = (data as AttendanceCenterResponse).report;
  if (!report || !Array.isArray(report.rows)) throw new Error("استجابة مركز التقرير غير صالحة");
  const byStatus: Partial<Record<ProfessionalAttendanceStatus, number>> = {};
  for (const row of report.rows) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  report.dataQuality = { ...report.dataQuality, byStatus };
  return report;
}

export async function getProfessionalAttendanceDrilldown(attendanceDay: string, employeeId: string) {
  const query = new URLSearchParams({ date: attendanceDay, from: attendanceDay, to: attendanceDay, employeeId, drilldown: "1" });
  const response = await fetch(`${API_URL}/api/manager/attendance-center?${query.toString()}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(responseError(data) || `HTTP ${response.status}`);
  if (!data || typeof data !== "object" || !("fact" in data) || !("sources" in data)) throw new Error("استجابة تفصيل التقرير غير صالحة");
  return data as ProfessionalAttendanceDrilldown;
}
