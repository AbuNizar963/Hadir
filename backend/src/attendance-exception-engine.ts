import { dateKey, getAttendanceShift } from "./attendance-period";

type Env = { DB: D1Database; APP_TIMEZONE?: string; };

const TZ = "Asia/Damascus";
const SAFETY_AFTER_SHIFT_MS = 6 * 60 * 60 * 1000;
const id = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function asMs(value: unknown) {
  const n = Date.parse(String(value || ""));
  return Number.isFinite(n) ? n : null;
}

async function notifyManagers(db: D1Database, employeeName: string, jobNumber: string, code: string) {
  const title = code === "MISSING_CLOCK_IN" ? "استثناء: تسجيل خروج بدون حضور" : code === "MISSING_CLOCK_OUT" ? "استثناء: لم يسجل الموظف الانصراف" : "استثناء: غياب كامل";
  const body = code === "MISSING_CLOCK_IN"
    ? `الموظف ${employeeName} (${jobNumber}) لديه تسجيل خروج بدون تسجيل دخول. يلزم طلب تسوية.`
    : code === "MISSING_CLOCK_OUT"
      ? `الموظف ${employeeName} (${jobNumber}) لديه حضور مفتوح تجاوز فترة الأمان. ساعات الرواتب = 0 حتى التسوية.`
      : `الموظف ${employeeName} (${jobNumber}) لم يسجل أي حركة خلال فترة المناوبة. تم تسجيل غياب.`;
  const managers = await db.prepare("SELECT id FROM admin_accounts WHERE role IN ('owner','manager','supervisor') AND active=1").all<any>();
  for (const manager of (managers.results || []) as any[]) {
    await db.prepare("INSERT INTO notifications(id,recipient_id,title,body,severity,type,created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(id(), String(manager.id), title, body, "warning", "attendance-exception", nowIso()).run().catch(() => undefined);
  }
}

export async function runAttendanceExceptionEngine(env: Env) {
  const tz = String(env.APP_TIMEZONE || TZ);
  const now = new Date();
  const nowMs = now.getTime();
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_exceptions (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, attendance_day TEXT NOT NULL,
      shift_start TEXT NOT NULL, shift_end TEXT NOT NULL, schedule_type TEXT NOT NULL,
      exception_code TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'OPEN', first_event_at TEXT,
      last_event_at TEXT, raw_worked_minutes INTEGER NOT NULL DEFAULT 0,
      payroll_approved_minutes INTEGER NOT NULL DEFAULT 0, safety_cutoff_at TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(employee_id, shift_start, exception_code)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_cutoff ON attendance_exceptions(safety_cutoff_at,state)"),
  ]);

  const employees = await env.DB.prepare(`SELECT id,name,job_number AS jobNumber,status,schedule_type AS scheduleType,
    work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,
    rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,
    grace_period_minutes AS gracePeriodMinutes FROM employees WHERE status='active'`).all<any>();

  let created = 0;
  for (const employee of (employees.results || []) as any[]) {
    const shift = getAttendanceShift(employee, now, tz);
    if (!shift.isWorkDay || shift.end.getTime() <= shift.start.getTime()) continue;

    const startIso = shift.start.toISOString();
    const endIso = shift.end.toISOString();
    const safetyCutoff = new Date(shift.end.getTime() + SAFETY_AFTER_SHIFT_MS);
    const events = await env.DB.prepare("SELECT type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<=? ORDER BY timestamp ASC")
      .bind(employee.id, startIso, new Date(Math.min(nowMs, safetyCutoff.getTime())).toISOString()).all<any>();
    const rows = (events.results || []) as any[];
    const checkIns = rows.filter(row => String(row.type) === "check-in");
    const checkOuts = rows.filter(row => String(row.type) === "check-out");
    const firstIn = checkIns[0] ? asMs(checkIns[0].timestamp) : null;
    const lastOut = checkOuts.length ? asMs(checkOuts[checkOuts.length - 1].timestamp) : null;

    let code: string | null = null;
    let cutoff = safetyCutoff;
    let rawMinutes = 0;
    if (!firstIn && lastOut && lastOut >= shift.start.getTime() && lastOut <= safetyCutoff.getTime()) {
      code = "MISSING_CLOCK_IN";
      cutoff = new Date(lastOut);
    } else if (firstIn && !lastOut && nowMs >= safetyCutoff.getTime()) {
      code = "MISSING_CLOCK_OUT";
      rawMinutes = Math.max(0, Math.round((Math.min(nowMs, shift.end.getTime()) - firstIn) / 60000));
    } else if (!firstIn && !lastOut && nowMs >= safetyCutoff.getTime()) {
      code = "NO_SHOW";
      rawMinutes = 0;
    }
    if (!code) continue;

    const day = dateKey(shift.start, tz);
    const existing = await env.DB.prepare("SELECT id,state FROM attendance_exceptions WHERE employee_id=? AND shift_start=? AND exception_code=? LIMIT 1")
      .bind(employee.id, startIso, code).first<any>();
    if (existing) continue;

    const createdAt = nowIso();
    await env.DB.prepare(`INSERT INTO attendance_exceptions
      (id,employee_id,attendance_day,shift_start,shift_end,schedule_type,exception_code,state,first_event_at,last_event_at,raw_worked_minutes,payroll_approved_minutes,safety_cutoff_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id(), employee.id, day, startIso, endIso, String(employee.scheduleType || "ADMIN").toUpperCase(), code,
        "PENDING_REGULARIZATION", firstIn ? new Date(firstIn).toISOString() : null, lastOut ? new Date(lastOut).toISOString() : null,
        rawMinutes, 0, cutoff.toISOString(), createdAt, createdAt).run();
    await notifyManagers(env.DB, String(employee.name || ""), String(employee.jobNumber || ""), code);
    created++;
  }
  return { ok: true, created, checkedEmployees: (employees.results || []).length, computedAt: nowIso() };
}
