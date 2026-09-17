type ReportRow = {
  attendanceDay: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string | null;
  status: string;
  attendanceSource: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  expectedMinutes: number | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  open: boolean;
  exceptionCode: string | null;
  attendanceEventIds: string[];
  requestIds: string[];
  auditIds: string[];
  historicalDataQuality: string;
};

/**
 * The report engine is the source of truth for the reportable employee/day set.
 *
 * This adapter intentionally performs no additional filtering. Eligibility for
 * work days, rotation days, and excluded REST/NOT_STARTED states is decided by
 * the reporting engine so every consumer sees the same row set.
 */
export function filterFutureCurrentDayRows<T extends { rows: ReportRow[] }>(report: T): T {
  return report;
}
