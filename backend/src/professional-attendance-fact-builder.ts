import { handleDailyStatus } from "./daily-status-api";

type Env = { DB: D1Database };

const TZ = "Asia/Damascus";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
const addDays = (day: string, n: number) => new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round(dayNumber(to) - dayNumber(from)) + 1;
const minutesBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
};
const json = (value: unknown) => JSON.stringify(value ?? []);

function tzParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function timezoneOffsetMinutes(day: string) {
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const local = tzParts(noonUtc);
  return Math.round((Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - noonUtc.getTime()) / 60000);
}

function localMidnightUtc(day: string) {
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 0, 0) - timezoneOffsetMinutes(day) * 60000);
}

function localDayNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function materializeDay(env: Env, day: string, actor: any, employeeId?: string) {
  const request = new Request(`https://internal/api/manager/daily-status?date=${encodeURIComponent(day)}`, { method: "GET" });
  const response = await handleDailyStatus(request, env, actor);
  if (!response.ok) throw new Error(`تعذر حساب حالة الدوام لليوم ${day}`);
  const payload = await response.json() as any;
  const employees = Array.isArray(payload.employees) ? payload.employees : [];
  const filtered = employees.filter((e: any) => !employeeId || String(e.employeeId) === employeeId);
  if (!filtered.length) return 0;

  const start = localMidnightUtc(day).toISOString();
  const next = addDays(day, 1);
  const end = localMidnightUtc(next).toISOString();
  const eventsResult = employeeId
    ? await env.DB.prepare("SELECT id,employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? AND employee_id=? ORDER BY timestamp ASC").bind(start, end, employeeId).all<any>()
    : await env.DB.prepare("SELECT id,employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(start, end).all<any>();
  const eventsByEmployee = new Map<string, any[]>();
  for (const event of eventsResult.results || []) {
    const id = String(event.employeeId || "");
    if (!id) continue;
    const list = eventsByEmployee.get(id) || [];
    list.push(event);
    eventsByEmployee.set(id, list);
  }

  const statements: D1PreparedStatement[] = [];
  const today = localDayNow();
  const quality = day === today ? "exact" : "reconstructed";
  const qualityReason = day === today ? "محسوب من بيانات اليوم الحالية" : "أعيد بناؤه من السجلات التاريخية المتاحة؛ لا توجد لقطة جدول تاريخية كاملة";

  for (const e of filtered) {
    const id = String(e.employeeId || "");
    if (!id) continue;
    const events = eventsByEmployee.get(id) || [];
    const ins = events.filter((x) => String(x.type) === "check-in");
    const outs = events.filter((x) => String(x.type) === "check-out");
    const checkInAt = String(e.checkInAt || ins[0]?.timestamp || "") || null;
    const checkOutAt = String(e.checkOutAt || outs[outs.length - 1]?.timestamp || "") || null;
    const workedMinutes = minutesBetween(checkInAt, checkOutAt);
    const expectedMinutes = minutesBetween(String(e.scheduledStart || "") || null, String(e.scheduledEnd || "") || null);
    const lateMinutes = String(e.status) === "LATE" && e.scheduledStart && checkInAt ? Math.max(0, minutesBetween(e.scheduledStart, checkInAt) || 0) : 0;
    const earlyLeaveMinutes = e.scheduledEnd && checkOutAt ? Math.max(0, minutesBetween(checkOutAt, e.scheduledEnd) || 0) : 0;
    const overtimeMinutes = e.scheduledEnd && checkOutAt ? Math.max(0, minutesBetween(e.scheduledEnd, checkOutAt) || 0) : 0;
    const open = checkInAt && !checkOutAt ? 1 : 0;
    const exceptionCode = outs.length && !ins.length ? "CHECKOUT_WITHOUT_CHECKIN" : open ? "MISSING_CHECKOUT" : String(e.status) === "ABSENT" ? "ABSENT_NO_APPROVED_REASON" : lateMinutes ? "LATE_ARRIVAL" : earlyLeaveMinutes ? "EARLY_LEAVE" : overtimeMinutes ? "OVERTIME" : null;

    const requests = await env.DB.prepare("SELECT id FROM requests WHERE employee_id=? AND ((start_date IS NULL AND end_date IS NULL) OR (start_date<=? AND end_date>=?)) AND status IN ('approved','confirmed')").bind(id, day, day).all<any>();
    const audits = await env.DB.prepare("SELECT id FROM audit WHERE employee_id=? AND timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(id, start, end).all<any>();
    const scheduleSnapshot = {
      scheduleType: e.scheduleType || null,
      scheduledStart: e.scheduledStart || null,
      scheduledEnd: e.scheduledEnd || null,
      expectedMinutes,
      timezone: TZ,
      capturedAt: new Date().toISOString(),
    };

    statements.push(env.DB.prepare(`INSERT INTO attendance_reporting_facts
      (attendance_day,employee_id,job_number,employee_name,location_id,status,schedule_type,scheduled_start,scheduled_end,expected_minutes,check_in_at,check_out_at,worked_minutes,late_minutes,early_leave_minutes,overtime_minutes,open,exception_code,attendance_event_ids_json,request_ids_json,audit_ids_json,calculation_source,calculation_version,historical_data_quality,timezone,computed_at,schedule_snapshot_json,data_quality_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(attendance_day,employee_id) DO UPDATE SET
        job_number=excluded.job_number,employee_name=excluded.employee_name,location_id=excluded.location_id,status=excluded.status,schedule_type=excluded.schedule_type,scheduled_start=excluded.scheduled_start,scheduled_end=excluded.scheduled_end,expected_minutes=excluded.expected_minutes,check_in_at=excluded.check_in_at,check_out_at=excluded.check_out_at,worked_minutes=excluded.worked_minutes,late_minutes=excluded.late_minutes,early_leave_minutes=excluded.early_leave_minutes,overtime_minutes=excluded.overtime_minutes,open=excluded.open,exception_code=excluded.exception_code,attendance_event_ids_json=excluded.attendance_event_ids_json,request_ids_json=excluded.request_ids_json,audit_ids_json=excluded.audit_ids_json,calculation_source=excluded.calculation_source,calculation_version=excluded.calculation_version,computed_at=excluded.computed_at,schedule_snapshot_json=CASE WHEN attendance_reporting_facts.historical_data_quality='exact' AND excluded.historical_data_quality='reconstructed' THEN attendance_reporting_facts.schedule_snapshot_json ELSE excluded.schedule_snapshot_json END,data_quality_reason=excluded.data_quality_reason`)
      .bind(day,id,String(e.jobNumber || ""),String(e.employeeName || ""),e.locationId || null,String(e.status || "INVALID"),String(e.scheduleType || "ADMIN"),e.scheduledStart || null,e.scheduledEnd || null,expectedMinutes,checkInAt,checkOutAt,workedMinutes,lateMinutes,earlyLeaveMinutes,overtimeMinutes,open,exceptionCode,json(events.map((x) => String(x.id))),json((requests.results || []).map((x: any) => String(x.id))),json((audits.results || []).map((x: any) => String(x.id))),"attendance+requests+schedule+daily_attendance_status", "report-v2", quality, TZ, new Date().toISOString(), json(scheduleSnapshot), qualityReason));
  }
  if (statements.length) await env.DB.batch(statements);
  return statements.length;
}

export async function ensureProfessionalAttendanceFacts(env: Env, from: string, to: string, actor: any, employeeId?: string) {
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) throw new Error("الفترة الزمنية غير صالحة");
  const days = daysBetween(from, to);
  if (days < 1 || days > 366) throw new Error("الفترة الزمنية تتجاوز الحد المسموح (366 يومًا)");
  let written = 0;
  for (let i = 0; i < days; i += 1) written += await materializeDay(env, addDays(from, i), actor, employeeId);
  return written;
}