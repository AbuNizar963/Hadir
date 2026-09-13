import { handleDailyStatus } from "./attendance-engine";
import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";

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

const dayFromRequest = (url: URL) => String(url.searchParams.get("date") || "").trim();
const fromRequest = (url: URL) => String(url.searchParams.get("from") || dayFromRequest(url)).trim();
const toRequest = (url: URL) => String(url.searchParams.get("to") || dayFromRequest(url)).trim();

const parseIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
};

async function fetchByIds(db: D1Database, table: "attendance" | "requests" | "audit", ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`).bind(...ids).all();
  const rows = (result.results || []) as Record<string, unknown>[];
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0));
}

async function buildAttendanceCenterDrilldown(env: Env, attendanceDay: string, employeeId: string, actor: any) {
  const report = await buildProfessionalAttendanceReport(env, attendanceDay, attendanceDay, employeeId, actor);
  const row = report.rows.find((candidate) => candidate.employeeId === employeeId && candidate.attendanceDay === attendanceDay);
  if (!row) return null;

  const factPromise = row.calculationSource === "attendance-engine-live"
    ? Promise.resolve(null)
    : env.DB.prepare("SELECT schedule_snapshot_json FROM attendance_reporting_facts WHERE attendance_day = ? AND employee_id = ? LIMIT 1")
      .bind(attendanceDay, employeeId)
      .first<Record<string, unknown>>();
  const [fact, attendance, requests, audit] = await Promise.all([
    factPromise,
    fetchByIds(env.DB, "attendance", parseIds(row.attendanceEventIds)),
    fetchByIds(env.DB, "requests", parseIds(row.requestIds)),
    fetchByIds(env.DB, "audit", parseIds(row.auditIds)),
  ]);

  let scheduleSnapshot: Record<string, unknown> = {};
  if (typeof fact?.schedule_snapshot_json === "string") {
    try {
      const parsed = JSON.parse(fact.schedule_snapshot_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) scheduleSnapshot = parsed as Record<string, unknown>;
    } catch {
      scheduleSnapshot = {};
    }
  }

  const sourceOfTruth = row.calculationSource === "attendance-engine-live" ? "attendance-engine" : "attendance_reporting_facts";
  return {
    ok: true,
    attendanceDay,
    employeeId,
    fact: {
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
      lateMinutes: row.lateMinutes,
      earlyLeaveMinutes: row.earlyLeaveMinutes,
      overtimeMinutes: row.overtimeMinutes,
      open: row.open,
      exceptionCode: row.exceptionCode,
      calculationSource: row.calculationSource,
      calculationVersion: row.calculationVersion,
      historicalDataQuality: row.historicalDataQuality,
      dataQualityReason: null,
      timezone: row.timezone,
      computedAt: row.computedAt,
      scheduleSnapshot,
    },
    sources: { attendance, requests, audit },
    trace: {
      attendanceEventIds: row.attendanceEventIds,
      requestIds: row.requestIds,
      auditIds: row.auditIds,
      sourceOfTruth,
      rawSource: "attendance",
      readOnly: true,
      noRawAttendanceMutation: true,
    },
  };
}

export async function handleAttendanceCenter(req: Request, env: Env, actor: any) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const origin = requestOrigin || String(env.APP_ORIGINS || env.APP_ORIGIN || "*").split(",")[0].trim() || "*";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "GET") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);

  const date = dayFromRequest(url);
  const from = fromRequest(url);
  const to = toRequest(url);
  if (!DAY_RE.test(date) || !DAY_RE.test(from) || !DAY_RE.test(to)) return json({ error: "التاريخ أو الفترة الزمنية غير صالحة" }, 400, origin);

  const employeeId = String(url.searchParams.get("employeeId") || "").trim() || undefined;

  try {
    if (url.searchParams.get("drilldown") === "1") {
      if (from !== to || !employeeId || date !== from) return json({ error: "التفصيل يحتاج يومًا واحدًا وموظفًا محددًا" }, 400, origin);
      const detail = await buildAttendanceCenterDrilldown(env, from, employeeId, actor);
      if (!detail) return json({ error: "سجل التقرير المطلوب غير موجود" }, 404, origin);
      return json(detail, 200, origin);
    }

    const dailyStatus = await handleDailyStatus(
      new Request(`https://internal/api/manager/daily-status?date=${encodeURIComponent(date)}`, {
        method: "GET",
        headers: req.headers,
      }),
      env,
      actor,
      false,
    );
    if (!dailyStatus.ok) {
      const payload = await dailyStatus.json().catch(() => ({ error: "تعذر قراءة مركز الحضور" }));
      return json(payload, dailyStatus.status, origin);
    }

    const report = await buildProfessionalAttendanceReport(env, from, to, employeeId, actor);
    const live = await dailyStatus.json();

    return json({
      ok: true,
      centerVersion: "1.1",
      timezone: "Asia/Damascus",
      date,
      from,
      to,
      attendance: live,
      report,
      integrity: {
        readOnly: true,
        noRawAttendanceMutation: true,
        attendanceSource: "attendance-engine",
        historicalReportSource: "attendance_reporting_facts",
      },
    }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر قراءة مركز الحضور والتقارير";
    console.error("attendance center failed", error);
    return json({ error: message }, 400, origin);
  }
}
