export type ProfessionalAttendanceRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string | null;
  locationId: string | null;
  status: string;
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
    dailySeries: Array<{ attendanceDay: string; present: number; late: number; absent: number; leave: number; permission: number; rest: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>;
    employeeSummaries: Array<{ employeeId: string; employeeName: string; jobNumber: string | null; days: number; present: number; late: number; absent: number; leave: number; permission: number; rest: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>;
    exceptionCounts: Record<string, number>;
    attendanceSourceCounts: Record<string, number>;
    exceptions: Array<{ attendanceDay: string; employeeId: string; employeeName: string; jobNumber: string | null; code: string; status: string; attendanceSource: ProfessionalAttendanceRow["attendanceSource"]; minutes: number; attendanceEventIds: string[]; requestIds: string[]; auditIds: string[] }>;
  };
  rows: ProfessionalAttendanceRow[];
  dataQuality: { byStatus: Record<string, number>; complete: boolean };
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
    status: string;
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

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const adminHeaders = () => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  return token ? { authorization: `Bearer ${token}` } : {};
};

export async function getProfessionalAttendanceReport(from: string, to: string, employeeId?: string) {
  const query = new URLSearchParams({ from, to });
  if (employeeId) query.set("employeeId", employeeId);
  const response = await fetch(`${API_URL}/api/reports/professional-attendance?${query.toString()}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as ProfessionalAttendanceReport | { error?: string } | null;
  if (!response.ok) throw new Error(String(data && "error" in data ? data.error : `HTTP ${response.status}`));
  return data as ProfessionalAttendanceReport;
}

export async function getProfessionalAttendanceDrilldown(attendanceDay: string, employeeId: string) {
  const query = new URLSearchParams({ from: attendanceDay, to: attendanceDay, employeeId, drilldown: "1" });
  const response = await fetch(`${API_URL}/api/reports/professional-attendance?${query.toString()}`, {
    headers: adminHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as ProfessionalAttendanceDrilldown | { error?: string } | null;
  if (!response.ok) throw new Error(String(data && "error" in data ? data.error : `HTTP ${response.status}`));
  return data as ProfessionalAttendanceDrilldown;
}
