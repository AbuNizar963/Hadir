import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";
import { ensureProfessionalAttendanceFacts } from "./professional-attendance-fact-builder";

type Env = { DB: D1Database; APP_ORIGIN?: string; APP_ORIGINS?: string };

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
    sources: {
      attendance,
      requests,
      audit,
    },
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

    await ensureProfessionalAttendanceFacts(env, from, to, actor, employeeId);
    const report = await buildProfessionalAttendanceReport(env, from, to, employeeId);
    return json(report, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بناء التقرير";
    console.error("professional attendance report failed", error);
    return json({ error: message }, 400, origin);
  }
}
