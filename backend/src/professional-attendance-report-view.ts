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
 * The report engine is the source of truth for the complete employee/day set.
 *
 * Do not hide current-day NOT_STARTED rows here. A report must represent every
 * employee returned by the attendance engine, including employees whose shift
 * has not started yet. UI consumers may choose how to present those states,
 * but the reporting API must never silently remove records.
 */
export function filterFutureCurrentDayRows<T extends { rows: ReportRow[] }>(report: T): T {
  return report;
}
