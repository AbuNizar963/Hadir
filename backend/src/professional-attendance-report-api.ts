import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
};

type ReportRow = {
  attendanceDay: string;
  employeeId: string;
  status: string;
  requestIds: string[];
  requestReason?: string | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const corsHeaders = (origin: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
  vary: "Origin",
});

const json = (data: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });

const parseIds = (value: unknown): string[] => {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

async function fetchByIds(
  db: D1Database,
  table: "attendance" | "requests" | "audit",
  ids: string[],
) {
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(",");
  const result = await db
    .prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all();

  const rows = (result.results || []) as Record<string, unknown>[];
  const order = new Map(ids.map((id, index) => [id, index]));

  return rows.sort(
    (a, b) =>
      (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0),
  );
}

/**
 * Attach the approved request reason without changing the report row set.
 * Completeness is owned by the reporting engine; this endpoint must never
 * remove NOT_STARTED, REST, or OPEN rows merely because a shift is unfinished.
 */
async function attachRequestReasons(env: Env, report: any) {
  const rows = (report.rows || []) as ReportRow[];
  const requestIds = Array.from(
    new Set(rows.flatMap((row) => row.requestIds || []).filter(Boolean)),
  );

  if (!requestIds.length) return report;

  const requests = await fetchByIds(env.DB, "requests", requestIds);
  const reasonsById = new Map(
    requests.map((request) => [
      String(request.id),
      String(request.reason || "").trim(),
    ]),
  );

  return {
    ...report,
    rows: rows.map((row) => {
      if (row.status !== "LEAVE" && row.status !== "PERMISSION") return row;

      const requestReason =
        (row.requestIds || [])
          .map((id) => reasonsById.get(String(id)) || "")
          .find(Boolean) || null;

      return { ...row, requestReason };
    }),
  };
}

async function buildProfessionalAttendanceDrilldown(
  env: Env,
  attendanceDay: string,
  employeeId: string,
) {
  const fact = await env.DB
    .prepare(
      `SELECT *
       FROM attendance_reporting_facts
       WHERE attendance_day = ? AND employee_id = ?
       LIMIT 1`,
    )
    .bind(attendanceDay, employeeId)
    .first<Record<string, unknown>>();

  if (!fact) return null;

  const attendanceEventIds = parseIds(fact.attendance_event_ids_json);
  const requestIds = parseIds(fact.request_ids_json);
  const auditIds = parseIds(fact.audit_ids_json);
  const scheduleSnapshot =
    typeof fact.schedule_snapshot_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(fact.schedule_snapshot_json);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed
              : {};
          } catch {
            return {};
          }
        })()
      : {};

  const [attendance, requests, audit] = await Promise.all([
    fetchByIds(env.DB, "attendance", attendanceEventIds),
    fetchByIds(env.DB, "requests", requestIds),
    fetchByIds(env.DB, "audit", auditIds),
  ]);

  const sourceSet = new Set<string>();
  for (const row of attendance) {
    const deviceId = String(row.device_id || "");
    const qrCode = String(row.qr_code || "");
    if (deviceId === "AUTO_VIP" || qrCode === "AUTO_VIP") {
      sourceSet.add("AUTOMATIC_VIP");
    } else if (
      qrCode === "AUTO_DIRECT" ||
      deviceId === "ADMIN_DIRECT:التلقائي"
    ) {
      sourceSet.add("AUTOMATIC");
    } else if (
      deviceId.startsWith("ADMIN_DIRECT:") ||
      deviceId === "ADMIN_DIRECT" ||
      qrCode === "ADMIN_DIRECT"
    ) {
      sourceSet.add("MANUAL_OWNER");
    } else {
      sourceSet.add("MANUAL_EMPLOYEE");
    }
  }

  const attendanceSource =
    sourceSet.size === 0
      ? "UNKNOWN"
      : sourceSet.size === 1
        ? Array.from(sourceSet)[0]
        : "MIXED";

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

export async function handleProfessionalAttendanceReport(
  req: Request,
  env: Env,
  actor: any,
) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "")
    .trim()
    .replace(/\/$/, "");
  const origin =
    requestOrigin ||
    String(env.APP_ORIGINS || env.APP_ORIGIN || "*")
      .split(",")[0]
      .trim() ||
    "*";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "GET") {
    return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  }

  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) {
    return json({ error: "غير مصرح" }, 403, origin);
  }

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const employeeId =
    String(url.searchParams.get("employeeId") || "").trim() || undefined;

  if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
    return json({ error: "الفترة الزمنية غير صالحة" }, 400, origin);
  }

  try {
    if (url.searchParams.get("drilldown") === "1") {
      if (from !== to || !employeeId) {
        return json(
          { error: "التفصيل يحتاج يومًا واحدًا وموظفًا محددًا" },
          400,
          origin,
        );
      }

      const detail = await buildProfessionalAttendanceDrilldown(
        env,
        from,
        employeeId,
      );
      if (!detail) {
        return json({ error: "سجل التقرير المطلوب غير موجود" }, 404, origin);
      }

      return json(detail, 200, origin);
    }

    const report = await buildProfessionalAttendanceReport(
      env,
      from,
      to,
      employeeId,
      actor,
    );
    const completeReport = await attachRequestReasons(env, report);

    // The canonical report engine already owns current-day/live reconciliation.
    // Returning its complete row set unchanged prevents this legacy endpoint
    // from disagreeing with /attendance-center about unfinished shifts.
    return json(completeReport, 200, origin);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر بناء التقرير";
    console.error("professional attendance report failed", error);
    return json({ error: message }, 400, origin);
  }
}
