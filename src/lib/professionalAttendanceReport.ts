export type ProfessionalAttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "PERMISSION" | "ESCAPED" | "NOT_STARTED" | "INVALID" | "OPEN";

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
  return token ? { authorization: `Bearer ${token}` } : {};
};

export async function getProfessionalAttendanceReport(from: string, to: string, employeeId?: string) {
  const query = new URLSearchParams({ date: to, from, to });
  if (employeeId) query.set("employeeId", employeeId);
  const response = await fetch(`${API_URL}/api/manager/attendance-center?${query.toString()}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as AttendanceCenterResponse | { error?: string } | null;
  if (!response.ok) throw new Error(String(data && "error" in data ? data.error : `HTTP ${response.status}`));
  if (!data || "error" in data || !data.report || !Array.isArray(data.report.rows)) throw new Error("استجابة مركز التقرير غير صالحة");
  const report = data.report;
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
  const data = await response.json().catch(() => null) as ProfessionalAttendanceDrilldown | { error?: string } | null;
  if (!response.ok) throw new Error(String(data && "error" in data ? data.error : `HTTP ${response.status}`));
  if (!data || "error" in data) throw new Error("استجابة تفصيل التقرير غير صالحة");
  return data;
}
