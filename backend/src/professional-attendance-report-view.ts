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

const damascusDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(date);

export function filterFutureCurrentDayRows<T extends { rows: ReportRow[]; summary: any; analytics: any; dataQuality: any }>(report: T): T {
  const now = new Date();
  const today = damascusDay(now);
  const visibleRows = report.rows.filter((row) => {
    if (row.attendanceDay !== today || row.status !== "NOT_STARTED" || !row.scheduledStart) return true;
    const scheduledStart = Date.parse(String(row.scheduledStart));
    return !Number.isFinite(scheduledStart) || scheduledStart <= now.getTime();
  });

  if (visibleRows.length === report.rows.length) return report;

  const employees = new Map<string, any>();
  const daily = new Map<string, any>();
  const exceptionCounts: Record<string, number> = {};
  const qualityCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let present = 0, late = 0, absent = 0, leave = 0, permission = 0, rest = 0, escaped = 0, notStarted = 0, invalid = 0, open = 0;
  let workedMinutes = 0, expectedMinutes = 0, lateMinutes = 0, earlyLeaveMinutes = 0, overtimeMinutes = 0;

  for (const row of visibleRows) {
    if (row.status === "PRESENT") present++;
    else if (row.status === "LATE") late++;
    else if (row.status === "ABSENT") absent++;
    else if (row.status === "LEAVE") leave++;
    else if (row.status === "PERMISSION") permission++;
    else if (row.status === "REST") rest++;
    else if (row.status === "ESCAPED") escaped++;
    else if (row.status === "NOT_STARTED") notStarted++;
    else if (row.status === "INVALID") invalid++;
    if (row.open) open++;
    workedMinutes += Number(row.workedMinutes || 0);
    expectedMinutes += Number(row.expectedMinutes || 0);
    lateMinutes += Number(row.lateMinutes || 0);
    earlyLeaveMinutes += Number(row.earlyLeaveMinutes || 0);
    overtimeMinutes += Number(row.overtimeMinutes || 0);
    if (row.exceptionCode) exceptionCounts[row.exceptionCode] = (exceptionCounts[row.exceptionCode] || 0) + 1;
    qualityCounts[row.historicalDataQuality] = (qualityCounts[row.historicalDataQuality] || 0) + 1;
    sourceCounts[row.attendanceSource] = (sourceCounts[row.attendanceSource] || 0) + 1;

    const employee = employees.get(row.employeeId) || {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      jobNumber: row.jobNumber,
      days: 0,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      permission: 0,
      rest: 0,
      escaped: 0,
      open: 0,
      workedMinutes: 0,
      expectedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
    };
    employee.days++;
    if (row.status === "PRESENT") employee.present++;
    if (row.status === "LATE") employee.late++;
    if (row.status === "ABSENT") employee.absent++;
    if (row.status === "LEAVE") employee.leave++;
    if (row.status === "PERMISSION") employee.permission++;
    if (row.status === "REST") employee.rest++;
    if (row.status === "ESCAPED") employee.escaped++;
    if (row.open) employee.open++;
    employee.workedMinutes += Number(row.workedMinutes || 0);
    employee.expectedMinutes += Number(row.expectedMinutes || 0);
    employee.lateMinutes += Number(row.lateMinutes || 0);
    employee.earlyLeaveMinutes += Number(row.earlyLeaveMinutes || 0);
    employee.overtimeMinutes += Number(row.overtimeMinutes || 0);
    employees.set(row.employeeId, employee);

    const series = daily.get(row.attendanceDay) || {
      attendanceDay: row.attendanceDay,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      permission: 0,
      rest: 0,
      escaped: 0,
      open: 0,
      workedMinutes: 0,
      expectedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
    };
    if (row.status === "PRESENT") series.present++;
    if (row.status === "LATE") series.late++;
    if (row.status === "ABSENT") series.absent++;
    if (row.status === "LEAVE") series.leave++;
    if (row.status === "PERMISSION") series.permission++;
    if (row.status === "REST") series.rest++;
    if (row.status === "ESCAPED") series.escaped++;
    if (row.open) series.open++;
    series.workedMinutes += Number(row.workedMinutes || 0);
    series.expectedMinutes += Number(row.expectedMinutes || 0);
    series.lateMinutes += Number(row.lateMinutes || 0);
    series.earlyLeaveMinutes += Number(row.earlyLeaveMinutes || 0);
    series.overtimeMinutes += Number(row.overtimeMinutes || 0);
    daily.set(row.attendanceDay, series);
  }

  const attendanceDenominator = present + late + absent;
  const punctualityDenominator = present + late;
  const attendanceRate = attendanceDenominator ? Number(((present + late) / attendanceDenominator * 100).toFixed(2)) : 0;
  const punctualityRate = punctualityDenominator ? Number((present / punctualityDenominator * 100).toFixed(2)) : 0;

  return {
    ...report,
    summary: {
      ...report.summary,
      employees: employees.size,
      employeeDays: visibleRows.length,
      present,
      late,
      absent,
      leave,
      permission,
      rest,
      escaped,
      notStarted,
      invalid,
      open,
      workedMinutes,
      expectedMinutes,
      workVarianceMinutes: workedMinutes - expectedMinutes,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      attendanceRate,
      punctualityRate,
    },
    analytics: {
      ...report.analytics,
      dailySeries: Array.from(daily.values()).sort((a, b) => a.attendanceDay.localeCompare(b.attendanceDay)),
      employeeSummaries: Array.from(employees.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ar")),
      exceptionCounts,
      attendanceSourceCounts: sourceCounts,
      exceptions: visibleRows.filter((row) => row.exceptionCode).map((row) => ({
        attendanceDay: row.attendanceDay,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        jobNumber: row.jobNumber,
        code: row.exceptionCode,
        status: row.status,
        attendanceSource: row.attendanceSource,
        minutes: row.lateMinutes || row.earlyLeaveMinutes || row.overtimeMinutes || 0,
        attendanceEventIds: row.attendanceEventIds,
        requestIds: row.requestIds,
        auditIds: row.auditIds,
      })),
    },
    rows: visibleRows,
    dataQuality: { byStatus: qualityCounts, complete: (qualityCounts.exact || 0) === visibleRows.length },
  } as T;
}
