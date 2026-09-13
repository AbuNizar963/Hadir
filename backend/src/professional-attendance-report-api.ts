import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";

type Env = { DB: D1Database; APP_ORIGIN?: string; APP_ORIGINS?: string };

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
  historicalDataQuality: string;
  timezone: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CORS = (origin: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
  vary: "Origin",
});

const json = (data: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(data), { status, headers: CORS(origin) });

const parseIds = (value: unknown): string[] => {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

async function fetchByIds(db: D1Database, table: "attendance" | "requests" | "audit", ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`).bind(...ids).all();
  const rows = (result.results || []) as Record<string, unknown>[];
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0));
}

function classifyAttendanceSource(attendance: Record<string, unknown>[]) {
  const sources = new Set<string>();
  for (const row of attendance) {
    const deviceId = String(row.device_id || "");
    const qrCode = String(row.qr_code || "");
    if (deviceId === "AUTO_VIP" || qrCode === "AUTO_VIP") sources.add("AUTOMATIC_VIP");
    else if (qrCode === "AUTO_DIRECT" || deviceId === "ADMIN_DIRECT:التلقائي") sources.add("AUTOMATIC");
    else if (deviceId.startsWith("ADMIN_DIRECT:") || deviceId === "ADMIN_DIRECT" || qrCode === "ADMIN_DIRECT") sources.add("MANUAL_OWNER");
    else sources.add("MANUAL_EMPLOYEE");
  }
  if (!sources.size) return "UNKNOWN";
  if (sources.size === 1) return Array.from(sources)[0];
  return "MIXED";
}

function damascusDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(date);
}

function filterFutureCurrentDayRows(report: any) {
  const now = new Date();
  const today = damascusDay(now);
  const rows = (report.rows || []) as ReportRow[];
  const visibleRows = rows.filter((row) => {
    if (row.attendanceDay !== today || row.status !== "NOT_STARTED" || !row.scheduledStart) return true;
    const scheduledStart = Date.parse(String(row.scheduledStart));
    return !Number.isFinite(scheduledStart) || scheduledStart <= now.getTime();
  });

  if (visibleRows.length === rows.length) return report;

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
  const attendanceRate = attendanceDenominator ? Number(((present + late) / attendanceDenominator * 100).toFixed(2)) : 0;
  const punctualityDenominator = present + late;
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
        auditIds: [],
      })),
    },
    rows: visibleRows,
    dataQuality: { byStatus: qualityCounts, complete: (qualityCounts.exact || 0) === visibleRows.length },
  };
}

async function buildProfessionalAttendanceDrilldown(env: Env, attendanceDay: string, employeeId: string) {
  const fact = await env.DB.prepare(
    `SELECT * FROM attendance_reporting_facts WHERE attendance_day = ? AND employee_id = ? LIMIT 1`,
  ).bind(attendanceDay, employeeId).first<Record<string, unknown>>();

  if (!fact) return null;

  const attendanceEventIds = parseIds(fact.attendance_event_ids_json);
  const requestIds = parseIds(fact.request_ids_json);
  const auditIds = parseIds(fact.audit_ids_json);
  const scheduleSnapshot = typeof fact.schedule_snapshot_json === "string"
    ? (() => { try { return JSON.parse(fact.schedule_snapshot_json); } catch { return {}; } })()
    : {};

  const [attendance, requests, audit] = await Promise.all([
    fetchByIds(env.DB, "attendance", attendanceEventIds),
    fetchByIds(env.DB, "requests", requestIds),
    fetchByIds(env.DB, "audit", auditIds),
  ]);
  const attendanceSource = classifyAttendanceSource(attendance);

  return {
    ok: true,
    attendanceDay,
    employeeId,
    fact: {
      attendanceDay: fact.attendance_day,
      employeeId: fact.employee_id,
      employeeName: fact.employee_name,
      jobNumber: fact.job_number,
      locationId: fact.location_id,
      status: fact.status,
      attendanceSource,
      scheduleType: fact.schedule_type,
      scheduledStart: fact.scheduled_start,
      scheduledEnd: fact.scheduled_end,
      expectedMinutes: fact.expected_minutes,
      checkInAt: fact.check_in_at,
      checkOutAt: fact.check_out_at,
      workedMinutes: fact.worked_minutes,
      lateMinutes: fact.late_minutes,
      earlyLeaveMinutes: fact.early_leave_minutes,
      overtimeMinutes: fact.overtime_minutes,
      open: Boolean(fact.open),
      exceptionCode: fact.exception_code,
      calculationSource: fact.calculation_source,
      calculationVersion: fact.calculation_version,
      historicalDataQuality: fact.historical_data_quality,
      dataQualityReason: fact.data_quality_reason,
      timezone: fact.timezone,
      computedAt: fact.computed_at,
      scheduleSnapshot,
    },
    sources: { attendance, requests, audit },
    trace: {
      attendanceEventIds,
      requestIds,
      auditIds,
      sourceOfTruth: "attendance_reporting_facts",
      rawSource: "attendance",
      readOnly: true,
      noRawAttendanceMutation: true,
    },
  };
}

export async function handleProfessionalAttendanceReport(req: Request, env: Env, actor: any) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const origin = requestOrigin || String(env.APP_ORIGINS || env.APP_ORIGIN || "*").split(",")[0].trim() || "*";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "GET") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const employeeId = String(url.searchParams.get("employeeId") || "").trim() || undefined;
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) return json({ error: "الفترة الزمنية غير صالحة" }, 400, origin);

  try {
    if (url.searchParams.get("drilldown") === "1") {
      if (from !== to || !employeeId) return json({ error: "التفصيل يحتاج يومًا واحدًا وموظفًا محددًا" }, 400, origin);
      const detail = await buildProfessionalAttendanceDrilldown(env, from, employeeId);
      if (!detail) return json({ error: "سجل التقرير المطلوب غير موجود" }, 404, origin);
      return json(detail, 200, origin);
    }

    const report = await buildProfessionalAttendanceReport(env, from, to, employeeId, actor);
    return json(filterFutureCurrentDayRows(report), 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بناء التقرير";
    console.error("professional attendance report failed", error);
    return json({ error: message }, 400, origin);
  }
}