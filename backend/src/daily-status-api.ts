type Env = { DB: D1Database; APP_ORIGIN?: string };

const DAY_MS = 86_400_000;
const TZ = "Asia/Damascus";

type EmployeeRow = {
  id: string; name: string; jobNumber: string; status: string; scheduleType: string;
  workStartTime: string | null; workEndTime: string | null; workDaysJson: string | null;
  rotationStartDate: string | null; rotationStartTime: string | null;
  rotationDaysOn: number | null; rotationDaysOff: number | null; gracePeriodMinutes: number | null;
};

function json(data: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization, x-device-id",
    "access-control-allow-methods": "GET,OPTIONS"
  }});
}
function tzParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))).getUTCDay()), hour: Number(get("hour")), minute: Number(get("minute")) };
}
function dayKey(date: Date) { const p = tzParts(date); return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`; }
function dayStartUtc(day: string) { return new Date(`${day}T00:00:00Z`); }
function addDays(day: string, amount: number) { const d = dayStartUtc(day); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); }
function parseTime(value: string | null | undefined, fallback: string) { const m = /^(\d{1,2}):(\d{2})/.exec(String(value || fallback)); return { h: Math.min(23, Math.max(0, Number(m?.[1] ?? fallback.slice(0,2)))), m: Math.min(59, Math.max(0, Number(m?.[2] ?? fallback.slice(3,5)))) }; }
function damascusOffsetMinutes(day: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const p = tzParts(noon);
  return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute) - noon.getTime()) / 60000);
}
function localDateTimeUtc(day: string, time: string | null | undefined) {
  const t = parseTime(time, "09:00");
  return new Date(Date.UTC(Number(day.slice(0,4)), Number(day.slice(5,7))-1, Number(day.slice(8,10)), t.h, t.m) - damascusOffsetMinutes(day) * 60000);
}
function scheduled(employee: EmployeeRow, day: string) {
  const kind = String(employee.scheduleType || "ADMIN").toUpperCase();
  if (kind === "ADMIN") {
    let days: number[] = [];
    try { const parsed = JSON.parse(employee.workDaysJson || "[]"); if (Array.isArray(parsed)) days = parsed.filter((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6).map(Number); } catch { days = []; }
    if (!employee.workDaysJson || !days.length) days = [0,1,2,3,4];
    const weekday = dayStartUtc(day).getUTCDay();
    if (!days.includes(weekday)) return { work: false, start: null as Date|null, end: null as Date|null, status: "REST" as const };
    const start = localDateTimeUtc(day, employee.workStartTime || "09:00");
    const end = localDateTimeUtc(day, employee.workEndTime || "16:00");
    const actualEnd = end.getTime() <= start.getTime() ? new Date(end.getTime() + DAY_MS) : end;
    return { work: true, start, end: actualEnd, status: "WORK" as const };
  }
  const startDay = String(employee.rotationStartDate || "").slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return { work: false, start: null, end: null, status: "INVALID" as const };
  const on = Math.max(1, Math.floor(Number(employee.rotationDaysOn ?? 4)));
  const off = Math.max(0, Math.floor(Number(employee.rotationDaysOff ?? 4)));
  const cycle = on + off;
  const first = localDateTimeUtc(startDay, employee.rotationStartTime || employee.workStartTime || "09:00");
  const targetNoon = localDateTimeUtc(day, "12:00");
  const elapsedDays = Math.floor((targetNoon.getTime() - first.getTime()) / DAY_MS);
  if (elapsedDays < 0) return { work: false, start: null, end: null, status: "NOT_STARTED" as const };
  const cycleDay = elapsedDays % cycle;
  const periodIndex = Math.floor(elapsedDays / cycle);
  const periodStart = new Date(first.getTime() + periodIndex * cycle * DAY_MS);
  if (cycleDay >= on) return { work: false, start: null, end: null, status: "REST" as const };
  return { work: true, start: periodStart, end: new Date(periodStart.getTime() + on * DAY_MS), status: "WORK" as const };
}

export async function handleDailyStatus(req: Request, env: Env, actor: any, origin: string) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,OPTIONS" }});
  if (!actor || !["owner","manager","supervisor"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);
  const url = new URL(req.url);
  const requestedDay = String(url.searchParams.get("date") || "").trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? requestedDay : dayKey(new Date());
  const employees = await env.DB.prepare("SELECT id,name,job_number AS jobNumber,status,schedule_type AS scheduleType,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,rotation_start_date AS rotationStartDate,rotation_start_time AS rotationStartTime,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,grace_period_minutes AS gracePeriodMinutes FROM employees WHERE status='active'").all<EmployeeRow>();
  const from = localDateTimeUtc(day, "00:00").toISOString();
  const next = addDays(day, 1);
  const to = localDateTimeUtc(next, "00:00").toISOString();
  const attendance = await env.DB.prepare("SELECT id,employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(from,to).all<any>();
  const requests = await env.DB.prepare("SELECT employee_id AS employeeId,type,status,created_at AS createdAt FROM requests WHERE status IN ('approved','confirmed') ORDER BY created_at DESC LIMIT 2000").all<any>();
  const byEmployee = new Map<string, any[]>();
  for (const row of attendance.results || []) { const id=String(row.employeeId); const list=byEmployee.get(id)||[]; list.push(row); byEmployee.set(id,list); }
  const leave = new Set((requests.results||[]).filter((r:any)=>String(r.type)==="leave").map((r:any)=>String(r.employeeId)));
  const result: any[] = [];
  for (const employee of employees.results || []) {
    const id=String(employee.id); const schedule=scheduled(employee,day); const rows=byEmployee.get(id)||[];
    const checkIn=rows.find(r=>String(r.type)==="check-in") || null;
    const checkOut=[...rows].reverse().find(r=>String(r.type)==="check-out") || null;
    let status: string;
    if (leave.has(id)) status="LEAVE";
    else if (schedule.status === "REST") status="REST";
    else if (schedule.status === "NOT_STARTED") status="NOT_STARTED";
    else if (schedule.status === "INVALID") status="INVALID";
    else if (!schedule.work) status="REST";
    else if (!checkIn) status="ABSENT";
    else {
      const grace=Number.isFinite(Number(employee.gracePeriodMinutes)) ? Math.max(0,Number(employee.gracePeriodMinutes)) : 10;
      status = schedule.start && Date.parse(String(checkIn.timestamp)) > schedule.start.getTime() + grace*60000 ? "LATE" : "PRESENT";
    }
    result.push({ attendanceDay: day, employeeId:id, employeeName:String(employee.name||""), jobNumber:String(employee.jobNumber||""), status, scheduleType:String(employee.scheduleType||"ADMIN").toUpperCase(), checkInAt:checkIn?.timestamp||null, checkOutAt:checkOut?.timestamp||null, scheduledStart:schedule.start?.toISOString()||null, scheduledEnd:schedule.end?.toISOString()||null });
  }
  const now = new Date().toISOString();
  await env.DB.batch(result.map(row => env.DB.prepare("INSERT INTO daily_attendance_status(attendance_day,employee_id,status,check_in_at,check_out_at,schedule_type,computed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(attendance_day,employee_id) DO UPDATE SET status=excluded.status,check_in_at=excluded.check_in_at,check_out_at=excluded.check_out_at,schedule_type=excluded.schedule_type,computed_at=excluded.computed_at").bind(row.attendanceDay,row.employeeId,row.status,row.checkInAt,row.checkOutAt,row.scheduleType,now)));
  return json({ attendanceDay: day, timezone: TZ, computedAt: now, total: result.length, counts: result.reduce((a:any,r:any)=>{a[r.status]=(a[r.status]||0)+1;return a;},{}), employees: result },200,origin);
}
