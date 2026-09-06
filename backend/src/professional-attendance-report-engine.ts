type Env = { DB: D1Database };

type FactRow = {
  attendanceDay: string;
  employeeId: string;
  jobNumber: string | null;
  employeeName: string;
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
  open: number;
  exceptionCode: string | null;
  attendanceEventIdsJson: string;
  requestIdsJson: string;
  auditIdsJson: string;
  attendanceSource: string;
  calculationSource: string;
  calculationVersion: string;
  historicalDataQuality: string;
  timezone: string;
  computedAt: string;
};

const MAX_DAYS = 366;
const VALID_STATUSES = new Set(["PRESENT", "LATE", "ABSENT", "REST", "LEAVE", "PERMISSION", "NOT_STARTED", "INVALID", "OPEN"]);
const jsonArray = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const dateNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86400000;
const daysBetween = (from: string, to: string) => Math.round(dateNumber(to) - dateNumber(from)) + 1;

function validatePeriod(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("الفترة الزمنية غير صالحة");
  const days = daysBetween(from, to);
  if (days < 1) throw new Error("الفترة الزمنية غير صالحة");
  if (days > MAX_DAYS) throw new Error(`الفترة تتجاوز الحد المسموح (${MAX_DAYS} يومًا)`);
  return days;
}

async function loadFacts(env: Env, from: string, to: string, employeeId?: string): Promise<FactRow[]> {
  const sourceExpression = `(SELECT CASE
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP')
      AND NOT EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id LIKE 'ADMIN_DIRECT:%')) THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
      AND NOT EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'MIXED'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
    WHEN json_array_length(f.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
    ELSE 'UNKNOWN'
  END FROM attendance_reporting_facts f2 WHERE f2.attendance_day = f.attendance_day AND f2.employee_id = f.employee_id)`;
  const sql = employeeId
    ? `SELECT f.attendance_day AS attendanceDay,f.employee_id AS employeeId,f.job_number AS jobNumber,f.employee_name AS employeeName,f.location_id AS locationId,f.status,f.schedule_type AS scheduleType,f.scheduled_start AS scheduledStart,f.scheduled_end AS scheduledEnd,f.expected_minutes AS expectedMinutes,f.check_in_at AS checkInAt,f.check_out_at AS checkOutAt,f.worked_minutes AS workedMinutes,f.late_minutes AS lateMinutes,f.early_leave_minutes AS earlyLeaveMinutes,f.overtime_minutes AS overtimeMinutes,f.open,f.exception_code AS exceptionCode,f.attendance_event_ids_json AS attendanceEventIdsJson,f.request_ids_json AS requestIdsJson,f.audit_ids_json AS auditIdsJson,${sourceExpression} AS attendanceSource,f.calculation_source AS calculationSource,f.calculation_version AS calculationVersion,f.historical_data_quality AS historicalDataQuality,f.timezone,f.computed_at AS computedAt FROM attendance_reporting_facts f WHERE f.attendance_day>=? AND f.attendance_day<=? AND f.employee_id=? ORDER BY f.attendance_day ASC,f.employee_name ASC`
    : `SELECT f.attendance_day AS attendanceDay,f.employee_id AS employeeId,f.job_number AS jobNumber,f.employee_name AS employeeName,f.location_id AS locationId,f.status,f.schedule_type AS scheduleType,f.scheduled_start AS scheduledStart,f.scheduled_end AS scheduledEnd,f.expected_minutes AS expectedMinutes,f.check_in_at AS checkInAt,f.check_out_at AS checkOutAt,f.worked_minutes AS workedMinutes,f.late_minutes AS lateMinutes,f.early_leave_minutes AS earlyLeaveMinutes,f.overtime_minutes AS overtimeMinutes,f.open,f.exception_code AS exceptionCode,f.attendance_event_ids_json AS attendanceEventIdsJson,f.request_ids_json AS requestIdsJson,f.audit_ids_json AS auditIdsJson,${sourceExpression} AS attendanceSource,f.calculation_source AS calculationSource,f.calculation_version AS calculationVersion,f.historical_data_quality AS historicalDataQuality,f.timezone,f.computed_at AS computedAt FROM attendance_reporting_facts f WHERE f.attendance_day>=? AND f.attendance_day<=? ORDER BY f.attendance_day ASC,f.employee_name ASC`;
  const query = employeeId ? env.DB.prepare(sql).bind(from, to, employeeId) : env.DB.prepare(sql).bind(from, to);
  const result = await query.all<FactRow>();
  return result.results || [];
}

function toPublicRow(row: FactRow) {
  return {
    attendanceDay: row.attendanceDay,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    jobNumber: row.jobNumber,
    locationId: row.locationId,
    status: row.status,
    attendanceSource: row.attendanceSource,
    scheduleType: row.scheduleType,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    expectedMinutes: row.expectedMinutes,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    workedMinutes: row.workedMinutes,
    lateMinutes: Number(row.lateMinutes || 0),
    earlyLeaveMinutes: Number(row.earlyLeaveMinutes || 0),
    overtimeMinutes: Number(row.overtimeMinutes || 0),
    open: Boolean(row.open),
    exceptionCode: row.exceptionCode,
    attendanceEventIds: jsonArray(row.attendanceEventIdsJson),
    requestIds: jsonArray(row.requestIdsJson),
    auditIds: jsonArray(row.auditIdsJson),
    calculationSource: row.calculationSource,
    calculationVersion: row.calculationVersion,
    historicalDataQuality: row.historicalDataQuality,
    timezone: row.timezone,
    computedAt: row.computedAt,
  };
}

export async function buildProfessionalAttendanceReport(env: Env, from: string, to: string, employeeId?: string) {
  const dayCount = validatePeriod(from, to);
  const sourceRows = await loadFacts(env, from, to, employeeId);
  const rows = sourceRows.filter((row) => VALID_STATUSES.has(row.status)).map(toPublicRow);
  const employees = new Map<string, { employeeId: string; employeeName: string; jobNumber: string | null; days: number; present: number; late: number; absent: number; leave: number; permission: number; rest: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>();
  const daily = new Map<string, any>();
  const exceptionCounts: Record<string, number> = {};
  let present = 0, late = 0, absent = 0, leave = 0, permission = 0, rest = 0, notStarted = 0, invalid = 0, open = 0;
  let workedMinutes = 0, expectedMinutes = 0, lateMinutes = 0, earlyLeaveMinutes = 0, overtimeMinutes = 0;
  const qualityCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};

  for (const row of rows) {
    if (row.status === "PRESENT") present++;
    else if (row.status === "LATE") late++;
    else if (row.status === "ABSENT") absent++;
    else if (row.status === "LEAVE") leave++;
    else if (row.status === "PERMISSION") permission++;
    else if (row.status === "REST") rest++;
    else if (row.status === "NOT_STARTED") notStarted++;
    else if (row.status === "INVALID") invalid++;
    if (row.open) open++;
    workedMinutes += Number(row.workedMinutes || 0);
    expectedMinutes += Number(row.expectedMinutes || 0);
    lateMinutes += row.lateMinutes;
    earlyLeaveMinutes += row.earlyLeaveMinutes;
    overtimeMinutes += row.overtimeMinutes;
    if (row.exceptionCode) exceptionCounts[row.exceptionCode] = (exceptionCounts[row.exceptionCode] || 0) + 1;
    qualityCounts[row.historicalDataQuality] = (qualityCounts[row.historicalDataQuality] || 0) + 1;
    sourceCounts[row.attendanceSource] = (sourceCounts[row.attendanceSource] || 0) + 1;

    const current = employees.get(row.employeeId) || { employeeId: row.employeeId, employeeName: row.employeeName, jobNumber: row.jobNumber, days: 0, present: 0, late: 0, absent: 0, leave: 0, permission: 0, rest: 0, open: 0, workedMinutes: 0, expectedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
    current.days++;
    if (row.status === "PRESENT") current.present++;
    if (row.status === "LATE") current.late++;
    if (row.status === "ABSENT") current.absent++;
    if (row.status === "LEAVE") current.leave++;
    if (row.status === "PERMISSION") current.permission++;
    if (row.status === "REST") current.rest++;
    if (row.open) current.open++;
    current.workedMinutes += Number(row.workedMinutes || 0);
    current.expectedMinutes += Number(row.expectedMinutes || 0);
    current.lateMinutes += row.lateMinutes;
    current.earlyLeaveMinutes += row.earlyLeaveMinutes;
    current.overtimeMinutes += row.overtimeMinutes;
    employees.set(row.employeeId, current);

    const series = daily.get(row.attendanceDay) || { attendanceDay: row.attendanceDay, present: 0, late: 0, absent: 0, leave: 0, permission: 0, rest: 0, open: 0, workedMinutes: 0, expectedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
    if (row.status === "PRESENT") series.present++;
    if (row.status === "LATE") series.late++;
    if (row.status === "ABSENT") series.absent++;
    if (row.status === "LEAVE") series.leave++;
    if (row.status === "PERMISSION") series.permission++;
    if (row.status === "REST") series.rest++;
    if (row.open) series.open++;
    series.workedMinutes += Number(row.workedMinutes || 0);
    series.expectedMinutes += Number(row.expectedMinutes || 0);
    series.lateMinutes += row.lateMinutes;
    series.earlyLeaveMinutes += row.earlyLeaveMinutes;
    series.overtimeMinutes += row.overtimeMinutes;
    daily.set(row.attendanceDay, series);
  }

  const attendanceDenominator = present + late + absent;
  const attendanceRate = attendanceDenominator ? Number(((present + late) / attendanceDenominator * 100).toFixed(2)) : 0;
  const punctualityDenominator = present + late;
  const punctualityRate = punctualityDenominator ? Number((present / punctualityDenominator * 100).toFixed(2)) : 0;
  const workVarianceMinutes = workedMinutes - expectedMinutes;

  return {
    ok: true,
    reportVersion: "2.0",
    generatedAt: new Date().toISOString(),
    timezone: rows[0]?.timezone || "Asia/Damascus",
    from,
    to,
    days: dayCount,
    filters: { employeeId: employeeId || null },
    summary: {
      employees: employees.size,
      employeeDays: rows.length,
      present, late, absent, leave, permission, rest, notStarted, invalid, open,
      workedMinutes, expectedMinutes, workVarianceMinutes, lateMinutes, earlyLeaveMinutes, overtimeMinutes,
      attendanceRate, punctualityRate,
    },
    analytics: {
      dailySeries: Array.from(daily.values()).sort((a, b) => a.attendanceDay.localeCompare(b.attendanceDay)),
      employeeSummaries: Array.from(employees.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ar")),
      exceptionCounts,
      attendanceSourceCounts: sourceCounts,
      exceptions: rows.filter((row) => row.exceptionCode).map((row) => ({
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
    rows,
    dataQuality: { byStatus: qualityCounts, complete: (qualityCounts.exact || 0) === rows.length },
    integrity: {
      sourceOfTruth: "attendance_reporting_facts",
      rawSource: "attendance",
      noRawAttendanceMutation: true,
      periodScoped: true,
      maxDays: MAX_DAYS,
      drillDownAvailable: true,
      sourceEventIdsIncluded: true,
      requestIdsIncluded: true,
      auditIdsIncluded: true,
      attendanceSourceDerivedFromRawEvents: true,
    },
  };
}
