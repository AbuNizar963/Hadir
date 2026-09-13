import { handleDailyStatus } from "./attendance-engine";

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
const VALID_STATUSES = new Set(["PRESENT", "LATE", "ABSENT", "REST", "LEAVE", "PERMISSION", "ESCAPED", "NOT_STARTED", "INVALID", "OPEN"]);
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
const damascusDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(date);

function validatePeriod(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("الفترة الزمنية غير صالحة");
  const days = daysBetween(from, to);
  if (days < 1) throw new Error("الفترة الزمنية غير صالحة");
  if (days > MAX_DAYS) throw new Error(`الفترة تتجاوز الحد المسموح (${MAX_DAYS} يومًا)`);
  return days;
}

async function loadFacts(env: Env, from: string, to: string, employeeId?: string): Promise<FactRow[]> {
  const sourceExpression = `(SELECT CASE
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE COALESCE(a.device_id,'') = 'AUTO_VIP' OR COALESCE(a.qr_code,'') = 'AUTO_VIP')
      AND NOT EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (COALESCE(a.device_id,'') IN ('AUTO_VIP','ADMIN_DIRECT:التلقائي') OR COALESCE(a.qr_code,'') IN ('AUTO_VIP','AUTO_DIRECT'))) THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE COALESCE(a.qr_code,'') = 'AUTO_DIRECT' OR COALESCE(a.device_id,'') = 'ADMIN_DIRECT:التلقائي')
      AND NOT EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (COALESCE(a.device_id,'') IN ('AUTO_VIP','ADMIN_DIRECT:التلقائي') OR COALESCE(a.qr_code,'') IN ('AUTO_VIP','AUTO_DIRECT'))) THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE COALESCE(a.device_id,'') IN ('AUTO_VIP','ADMIN_DIRECT:التلقائي') OR COALESCE(a.qr_code,'') IN ('AUTO_VIP','AUTO_DIRECT')) THEN 'MIXED'
    WHEN EXISTS (SELECT 1 FROM json_each(f.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE COALESCE(a.device_id,'') LIKE 'ADMIN_DIRECT:%' OR COALESCE(a.qr_code,'') = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
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

async function loadLiveTodayFacts(env: Env, day: string, employeeId: string | undefined, actor: any): Promise<FactRow[]> {
  if (day !== damascusDay() || !actor) return [];
  try {
    const response = await handleDailyStatus(
      new Request(`https://internal/api/manager/daily-status?date=${encodeURIComponent(day)}`),
      env,
      actor,
      false,
    );
    if (!response.ok) return [];
    const payload = await response.json() as any;
    const liveEmployees = (Array.isArray(payload.employees) ? payload.employees : [])
      .filter((row: any) => !employeeId || String(row.employeeId) === employeeId);
    if (!liveEmployees.length) return [];

    const dayAnchor = Date.parse(`${day}T00:00:00Z`);
    const attendanceRows = await env.DB.prepare(
      "SELECT id,employee_id AS employeeId,type,timestamp,device_id AS deviceId,qr_code AS qrCode FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC",
    ).bind(new Date(dayAnchor - 86400000).toISOString(), new Date(dayAnchor + 172800000).toISOString()).all<any>();
    const eventsByEmployee = new Map<string, any[]>();
    for (const event of attendanceRows.results || []) {
      if (damascusDay(new Date(String(event.timestamp))) !== day) continue;
      const id = String(event.employeeId || "");
      if (!id) continue;
      const list = eventsByEmployee.get(id) || [];
      list.push(event);
      eventsByEmployee.set(id, list);
    }

    const classifySource = (events: any[]) => {
      const sources = new Set<string>();
      for (const event of events) {
        const deviceId = String(event.deviceId || "");
        const qrCode = String(event.qrCode || "");
        if (deviceId === "AUTO_VIP" || qrCode === "AUTO_VIP") sources.add("AUTOMATIC_VIP");
        else if (qrCode === "AUTO_DIRECT" || deviceId === "ADMIN_DIRECT:التلقائي") sources.add("AUTOMATIC");
        else if (deviceId.startsWith("ADMIN_DIRECT:") || deviceId === "ADMIN_DIRECT" || qrCode === "ADMIN_DIRECT") sources.add("MANUAL_OWNER");
        else sources.add("MANUAL_EMPLOYEE");
      }
      if (!sources.size) return "UNKNOWN";
      if (sources.size === 1) return Array.from(sources)[0];
      return "MIXED";
    };

    return liveEmployees.map((row: any): FactRow => {
      const events = eventsByEmployee.get(String(row.employeeId)) || [];
      const checkInAt = row.checkInAt || null;
      const checkOutAt = row.checkOutAt || null;
      const expectedStart = row.scheduledStart || null;
      const expectedEnd = row.scheduledEnd || null;
      const expectedMinutes = expectedStart && expectedEnd ? Math.max(0, Math.round((Date.parse(expectedEnd) - Date.parse(expectedStart)) / 60000)) : 0;
      const workedMinutes = checkInAt && checkOutAt ? Math.max(0, Math.round((Date.parse(checkOutAt) - Date.parse(checkInAt)) / 60000)) : null;
      const lateMinutes = row.status === "LATE" && checkInAt && expectedStart ? Math.max(0, Math.round((Date.parse(checkInAt) - Date.parse(expectedStart)) / 60000)) : 0;
      const earlyLeaveMinutes = checkOutAt && expectedEnd ? Math.max(0, Math.round((Date.parse(expectedEnd) - Date.parse(checkOutAt)) / 60000)) : 0;
      const overtimeMinutes = checkOutAt && expectedEnd ? Math.max(0, Math.round((Date.parse(checkOutAt) - Date.parse(expectedEnd)) / 60000)) : 0;
      const exceptionCode = row.status === "ABSENT" ? "ABSENT_NO_APPROVED_REASON" : row.status === "OPEN" ? "MISSING_CHECKOUT" : lateMinutes ? "LATE_ARRIVAL" : earlyLeaveMinutes ? "EARLY_LEAVE" : overtimeMinutes ? "OVERTIME" : null;
      return {
        attendanceDay: day,
        employeeId: String(row.employeeId),
        jobNumber: String(row.jobNumber || ""),
        employeeName: String(row.employeeName || ""),
        locationId: null,
        status: String(row.status || "INVALID"),
        scheduleType: String(row.scheduleType || "ADMIN"),
        scheduledStart: expectedStart,
        scheduledEnd: expectedEnd,
        expectedMinutes,
        checkInAt,
        checkOutAt,
        workedMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        open: row.status === "OPEN" ? 1 : 0,
        exceptionCode,
        attendanceEventIdsJson: JSON.stringify(events.map((event) => String(event.id))),
        requestIdsJson: "[]",
        auditIdsJson: "[]",
        attendanceSource: classifySource(events),
        calculationSource: "attendance-engine-live",
        calculationVersion: "daily-status-v1",
        historicalDataQuality: "exact",
        timezone: "Asia/Damascus",
        computedAt: String(payload.computedAt || new Date().toISOString()),
      };
    });
  } catch (error) {
    console.error("professional attendance live read failed", { day, error });
    return [];
  }
}

export async function buildProfessionalAttendanceReport(env: Env, from: string, to: string, employeeId?: string, actor?: any) {
  const dayCount = validatePeriod(from, to);
  const sourceRows = await loadFacts(env, from, to, employeeId);
  const currentDay = damascusDay();
  const liveRows = from <= currentDay && currentDay <= to ? await loadLiveTodayFacts(env, currentDay, employeeId, actor) : [];
  const rows = [...sourceRows.filter((row) => row.attendanceDay !== currentDay), ...liveRows]
    .filter((row) => VALID_STATUSES.has(row.status))
    .map(toPublicRow);
  const employees = new Map<string, { employeeId: string; employeeName: string; jobNumber: string | null; days: number; present: number; late: number; absent: number; leave: number; permission: number; rest: number; escaped: number; open: number; workedMinutes: number; expectedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }>();
  const daily = new Map<string, any>();
  const exceptionCounts: Record<string, number> = {};
  let present = 0, late = 0, absent = 0, leave = 0, permission = 0, rest = 0, escaped = 0, notStarted = 0, invalid = 0, open = 0;
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
    else if (row.status === "ESCAPED") escaped++;
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

    const current = employees.get(row.employeeId) || { employeeId: row.employeeId, employeeName: row.employeeName, jobNumber: row.jobNumber, days: 0, present: 0, late: 0, absent: 0, leave: 0, permission: 0, rest: 0, escaped: 0, open: 0, workedMinutes: 0, expectedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
    current.days++;
    if (row.status === "PRESENT") current.present++;
    if (row.status === "LATE") current.late++;
    if (row.status === "ABSENT") current.absent++;
    if (row.status === "LEAVE") current.leave++;
    if (row.status === "PERMISSION") current.permission++;
    if (row.status === "REST") current.rest++;
    if (row.status === "ESCAPED") current.escaped++;
    if (row.open) current.open++;
    current.workedMinutes += Number(row.workedMinutes || 0);
    current.expectedMinutes += Number(row.expectedMinutes || 0);
    current.lateMinutes += row.lateMinutes;
    current.earlyLeaveMinutes += row.earlyLeaveMinutes;
    current.overtimeMinutes += row.overtimeMinutes;
    employees.set(row.employeeId, current);

    const series = daily.get(row.attendanceDay) || { attendanceDay: row.attendanceDay, present: 0, late: 0, absent: 0, leave: 0, permission: 0, rest: 0, escaped: 0, open: 0, workedMinutes: 0, expectedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
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
      present, late, absent, leave, permission, rest, escaped, notStarted, invalid, open,
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