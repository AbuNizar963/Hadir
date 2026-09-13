import { dateKey, getAttendanceShift, getAttendanceShiftForDay } from "./attendance-period";
import { submitAttendanceThroughCentralEngine } from "./attendance-engine-central";

type Env = {
  DB: D1Database;
  APP_TIMEZONE?: string;
};

const MAX_BINDINGS_PER_QUERY = 90;

export function dateKeyLocal(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function operationalShift(employee: any, current: Date, tz: string) {
  const day = dateKeyLocal(current, tz);

  if (String(employee.scheduleType || "").toUpperCase() === "ROTATION") {
    return getAttendanceShiftForDay(employee, day, tz);
  }

  return getAttendanceShift(employee, current, tz);
}

/**
 * Compatibility name kept for existing callers.
 * All automatic/VIP attendance writes go through the canonical attendance
 * engine so duplicate attendance rows cannot be created by this helper.
 */
export async function insertAutomaticAttendance(
  env: Env,
  employee: any,
  type: "check-in" | "check-out",
  timestamp: string,
  _actorName: string,
  reason: string,
) {
  const deviceId = `CENTRAL_AUTO:${employee.id}`;
  const result = await submitAttendanceThroughCentralEngine(
    env,
    String(employee.id),
    type,
    deviceId,
    reason,
    timestamp,
  );

  if (result.error || !result.response) return null;

  const payload = (await result.response.json().catch(() => ({}))) as any;
  if (!result.response.ok || !payload?.ok) return null;

  return payload.record || null;
}

async function loadActiveAutomaticEmployees(env: Env) {
  return env.DB
    .prepare(
      "SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees WHERE status='active' AND (is_vip=1 OR auto_check_in=1 OR auto_check_out=1) ORDER BY name",
    )
    .all<any>();
}

async function loadActiveRequests(env: Env, day: string) {
  const result = await env.DB
    .prepare(
      "SELECT employee_id AS employeeId,type,start_date AS startDate,end_date AS endDate,created_at AS createdAt FROM requests WHERE status IN ('approved','confirmed') AND type IN ('leave','permission') AND COALESCE(start_date,substr(created_at,1,10))<=? AND COALESCE(end_date,COALESCE(start_date,substr(created_at,1,10)))>=?",
    )
    .bind(day, day)
    .all<any>();

  const ids = new Set<string>();
  for (const row of result.results || []) {
    const id = String(row.employeeId || "").trim();
    if (id) ids.add(id);
  }

  return ids;
}

async function loadAttendanceForEmployees(
  env: Env,
  employeeIds: string[],
  from: string,
  to: string,
) {
  const byEmployee = new Map<string, any[]>();

  for (let offset = 0; offset < employeeIds.length; offset += MAX_BINDINGS_PER_QUERY) {
    const ids = employeeIds.slice(offset, offset + MAX_BINDINGS_PER_QUERY);
    const placeholders = ids.map(() => "?").join(",");
    const result = await env.DB
      .prepare(
        `SELECT employee_id AS employeeId,type,timestamp FROM attendance WHERE employee_id IN (${placeholders}) AND timestamp>=? AND timestamp<? ORDER BY employee_id,timestamp ASC`,
      )
      .bind(...ids, from, to)
      .all<any>();

    for (const row of result.results || []) {
      const id = String(row.employeeId || "");
      if (!id) continue;

      const rows = byEmployee.get(id) || [];
      rows.push(row);
      byEmployee.set(id, rows);
    }
  }

  return byEmployee;
}

function maxRotationDaysOn(employees: any[]) {
  return Math.max(
    1,
    ...employees.map((employee) =>
      String(employee.scheduleType || "").toUpperCase() === "ROTATION"
        ? Math.max(1, Math.floor(Number(employee.rotationDaysOn ?? 4)))
        : 1,
    ),
  );
}

export async function runAutomaticAttendance(env: Env) {
  const configured = await env.DB
    .prepare("SELECT value FROM settings WHERE key='timezone' LIMIT 1")
    .first<any>()
    .catch(() => null);

  let tz = String(env.APP_TIMEZONE || "Asia/Damascus");
  try {
    const parsed = JSON.parse(String(configured?.value || ""));
    if (typeof parsed === "string" && parsed.trim()) {
      tz = parsed.trim();
    }
  } catch {
    if (String(configured?.value || "").trim()) {
      tz = String(configured.value).trim();
    }
  }

  const current = new Date();
  const currentDay = dateKeyLocal(current, tz);
  const employeesResult = await loadActiveAutomaticEmployees(env);
  const employees = (employeesResult.results || []) as any[];

  if (!employees.length) {
    return { ok: true, timezone: tz, processed: 0, created: [] };
  }

  const employeeIds = employees.map((employee) => String(employee.id));
  const activeRequestIds = await loadActiveRequests(env, currentDay);
  const rotationDaysOn = maxRotationDaysOn(employees);
  const fromDay = new Date(
    Date.parse(`${currentDay}T00:00:00Z`) - rotationDaysOn * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const toDay = new Date(
    Date.parse(`${currentDay}T00:00:00Z`) + 2 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const from = new Date(`${fromDay}T00:00:00Z`).toISOString();
  const to = new Date(`${toDay}T00:00:00Z`).toISOString();
  const attendanceByEmployee = await loadAttendanceForEmployees(
    env,
    employeeIds,
    from,
    to,
  );

  const results: any[] = [];

  for (const employee of employees) {
    if (activeRequestIds.has(String(employee.id))) continue;

    const shift = operationalShift(employee, current, tz);
    if (!shift.isWorkDay) continue;

    const rows = attendanceByEmployee.get(String(employee.id)) || [];
    const shiftRows = rows.filter((row: any) => {
      const timestamp = Date.parse(String(row.timestamp));
      return (
        Number.isFinite(timestamp) &&
        timestamp >= shift.start.getTime() &&
        timestamp < shift.end.getTime() + 60_000
      );
    });

    let hasShiftIn = shiftRows.some((row: any) => row.type === "check-in");
    const hasShiftOut = shiftRows.some((row: any) => row.type === "check-out");

    if (
      (employee.autoCheckIn || employee.isVip) &&
      current >= shift.start &&
      !hasShiftIn
    ) {
      const record = await insertAutomaticAttendance(
        env,
        employee,
        "check-in",
        shift.start.toISOString(),
        "التلقائي",
        "تحضير تلقائي حسب بداية المناوبة للموظف VIP/التلقائي",
      );

      if (record) {
        shiftRows.push({ type: record.type, timestamp: record.timestamp });
        hasShiftIn = true;
        results.push(record);
      }
    }

    const latestShiftIn = [...shiftRows]
      .filter(
        (row) =>
          row.type === "check-in" &&
          Date.parse(String(row.timestamp)) <= shift.end.getTime(),
      )
      .sort(
        (a, b) =>
          Date.parse(String(b.timestamp)) - Date.parse(String(a.timestamp)),
      )[0];

    if (
      (employee.autoCheckOut || employee.isVip) &&
      !hasShiftOut &&
      latestShiftIn &&
      current >= shift.end
    ) {
      const record = await insertAutomaticAttendance(
        env,
        employee,
        "check-out",
        shift.end.toISOString(),
        "التلقائي",
        "انصراف تلقائي حسب نهاية المناوبة للموظف VIP/التلقائي",
      );

      if (record) {
        results.push(record);
      }
    }
  }

  return {
    ok: true,
    timezone: tz,
    processed: employees.length,
    created: results,
  };
}
