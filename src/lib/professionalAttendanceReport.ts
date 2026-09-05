export type ProfessionalAttendanceRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string | null;
  locationId: string | null;
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
    exceptions: Array<{ attendanceDay: string; employeeId: string; employeeName: string; jobNumber: string | null; code: string; status: string; minutes: number; attendanceEventIds: string[]; requestIds: string[]; auditIds: string[] }>;
  };
  rows: ProfessionalAttendanceRow[];
  dataQuality: { byStatus: Record<string, number>; complete: boolean };
  integrity: { sourceOfTruth: string; rawSource: string; noRawAttendanceMutation: boolean; periodScoped: boolean; maxDays: number; drillDownAvailable: boolean; sourceEventIdsIncluded: boolean; requestIdsIncluded: boolean; auditIdsIncluded: boolean };
};

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

export async function getProfessionalAttendanceReport(from: string, to: string, employeeId?: string) {
  const token = typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token.admin") || "";
  const query = new URLSearchParams({ from, to });
  if (employeeId) query.set("employeeId", employeeId);
  const response = await fetch(`${API_URL}/api/reports/professional-attendance?${query.toString()}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as ProfessionalAttendanceReport | { error?: string } | null;
  if (!response.ok) throw new Error(String(data && "error" in data ? data.error : `HTTP ${response.status}`));
  return data as ProfessionalAttendanceReport;
}
