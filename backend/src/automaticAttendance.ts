import { dateKeyLocal, insertAutomaticAttendance, operationalShift } from "./attendance-engine-automatic-commands";

export { runAutomaticAttendance } from "./attendance-engine-automatic-commands";

type Env = {
  DB: D1Database;
  APP_TIMEZONE?: string;
};

type Admin = {
  id: string;
  name?: string;
  role: string;
};

const OWNER =
  "المالك فقط يستطيع تنفيذ التحضير أو الانصراف المباشر أو تعديل التلقائي";

const json = (data: unknown, status = 200, origin = "*") =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "cache-control": "no-store",
    },
  });

function roleIsOwner(actor: Admin | null) {
  return !!actor && String(actor.role).toLowerCase() === "owner";
}

export async function directAttendance(
  req: Request,
  env: Env,
  actor: Admin | null,
  origin: string,
) {
  const path = new URL(req.url).pathname;
  const supportedPaths = [
    "/api/manager/attendance/checkout",
    "/api/manager/attendance/check-in",
    "/api/manager/attendance",
  ];

  if (!supportedPaths.includes(path) || req.method !== "POST") return null;

  if (!actor || !["owner", "manager"].includes(String(actor.role).toLowerCase())) {
    return json({ error: OWNER }, 403, origin);
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const employeeId = String(body.employeeId || "").trim();
  if (!employeeId) return json({ error: "الموظف مطلوب" }, 400, origin);

  const employee = await env.DB
    .prepare(
      "SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson FROM employees WHERE id=? LIMIT 1",
    )
    .bind(employeeId)
    .first<any>();

  if (!employee || employee.status !== "active") {
    return json({ error: "الموظف غير موجود أو موقوف" }, 404, origin);
  }

  const type = path.endsWith("checkout")
    ? "check-out"
    : path.endsWith("check-in")
      ? "check-in"
      : body.type === "check-out"
        ? "check-out"
        : "check-in";

  const current = new Date();
  const tz = env.APP_TIMEZONE || "Asia/Damascus";
  const shift = operationalShift(employee, current, tz);

  if (!shift.isWorkDay) {
    return json({ error: "لا يوجد دوام للموظف الآن" }, 403, origin);
  }

  const rows = await env.DB
    .prepare(
      "SELECT type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<=? ORDER BY timestamp ASC",
    )
    .bind(
      employeeId,
      shift.start.toISOString(),
      new Date(Math.min(shift.end.getTime() + 60_000, current.getTime())).toISOString(),
    )
    .all<any>();

  const periodRows = (rows.results || []) as any[];
  const last = periodRows[periodRows.length - 1];

  if (
    type === "check-in" &&
    periodRows.some((row: any) => row.type === "check-in")
  ) {
    return json(
      { error: "الموظف مسجل حضور بالفعل لهذه المناوبة" },
      409,
      origin,
    );
  }

  if (type === "check-out" && last?.type !== "check-in") {
    return json(
      { error: "لا يمكن تسجيل الانصراف قبل تسجيل الحضور لهذه المناوبة" },
      409,
      origin,
    );
  }

  if (type === "check-out" && current.getTime() < shift.end.getTime()) {
    return json({ error: "لم ينتهِ وقت دوام الموظف بعد" }, 403, origin);
  }

  const record = await insertAutomaticAttendance(
    env,
    employee,
    type,
    current.toISOString(),
    actor.name ||
      (String(actor.role).toLowerCase() === "manager" ? "المدير" : "المالك"),
    type === "check-in"
      ? "تحضير مباشر لمهمة/مأمورية"
      : "انصراف مباشر لمهمة/مأمورية",
  );

  if (!record) {
    return json(
      { error: "تعذر تسجيل الحضور عبر المحرك المركزي" },
      409,
      origin,
    );
  }

  // The canonical attendance engine already refreshes the derived daily-status
  // and professional-report facts after a successful mutation. Do not repeat
  // those full D1 refreshes here.
  return json({ ok: true, record }, 201, origin);
}

export async function workforceControls(
  req: Request,
  env: Env,
  actor: Admin | null,
  origin: string,
) {
  const url = new URL(req.url);

  if (!url.pathname.startsWith("/api/manager/workforce-controls")) return null;

  if (
    !actor ||
    !["owner", "manager", "supervisor"].includes(
      String(actor.role).toLowerCase(),
    )
  ) {
    return json({ error: "غير مصرح" }, 403, origin);
  }

  if (req.method === "GET") {
    const rows = await env.DB
      .prepare(
        "SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees ORDER BY name",
      )
      .all<any>();

    return json(
      (rows.results || []).map((employee: any) => ({
        ...employee,
        isVip: Boolean(employee.isVip),
        autoCheckIn: Boolean(employee.autoCheckIn),
        autoCheckOut: Boolean(employee.autoCheckOut),
        workDays: (() => {
          try {
            return JSON.parse(employee.workDaysJson || "[]");
          } catch {
            return [];
          }
        })(),
      })),
      200,
      origin,
    );
  }

  const match = url.pathname.match(
    /^\/api\/manager\/workforce-controls\/([^/]+)$/,
  );

  if (!match || req.method !== "PATCH") {
    return json({ error: "WORKFORCE_CONTROL_ROUTE_NOT_FOUND" }, 404, origin);
  }

  if (!roleIsOwner(actor)) {
    return json({ error: OWNER }, 403, origin);
  }

  const employeeId = decodeURIComponent(match[1]);
  const employee = await env.DB
    .prepare("SELECT id FROM employees WHERE id=? LIMIT 1")
    .bind(employeeId)
    .first();

  if (!employee) {
    return json({ error: "EMPLOYEE_NOT_FOUND" }, 404, origin);
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const fields: string[] = [];
  const values: any[] = [];
  const vip = typeof body.isVip === "boolean" ? body.isVip : null;
  const hasAutoCheckIn = typeof body.autoCheckIn === "boolean";
  const hasAutoCheckOut = typeof body.autoCheckOut === "boolean";

  if (vip !== null) {
    fields.push("is_vip=?", "auto_check_in=?", "auto_check_out=?");
    values.push(vip ? 1 : 0, vip ? 1 : 0, vip ? 1 : 0);
  } else {
    if (hasAutoCheckIn) {
      fields.push("auto_check_in=?");
      values.push(body.autoCheckIn ? 1 : 0);
    }
    if (hasAutoCheckOut) {
      fields.push("auto_check_out=?");
      values.push(body.autoCheckOut ? 1 : 0);
    }
  }

  if (!fields.length) {
    return json({ error: "لا توجد تغييرات" }, 400, origin);
  }

  values.push(employeeId);
  await env.DB
    .prepare(`UPDATE employees SET ${fields.join(",")} WHERE id=?`)
    .bind(...values)
    .run();

  return json({ ok: true, employeeId }, 200, origin);
}
