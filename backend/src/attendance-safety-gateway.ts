import production, { HadirRealtime } from "./attendance-production-gateway";

export { HadirRealtime };

type Env = {
  DB: D1Database;
  REALTIME: DurableObjectNamespace;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  REPORT_ARCHIVE?: R2Bucket;
  BROWSER?: BrowserRun;
};

async function currentUser(request: Request, env: Env, ctx: ExecutionContext) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";
  const probe = await production.fetch(new Request(probeUrl, { method: "GET", headers: request.headers }), env, ctx);
  if (!probe.ok) return null;
  const data = await probe.json().catch(() => ({})) as any;
  return data?.user || null;
}

async function isStaff(request: Request, env: Env, ctx: ExecutionContext) {
  const user = await currentUser(request, env, ctx);
  return user?.role === "staff";
}

function localDay(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => p.find(x => x.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayStart(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(utcNoon);
  const get = (type: string) => parts.find(x => x.type === type)?.value || "";
  const offset = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), Number(get("hour")), Number(get("minute"))) - utcNoon.getTime();
  return utcNoon.getTime() - offset - 12 * 60 * 60 * 1000;
}

function parts(date: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => p.find(x => x.type === type)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
}

function offsetMinutes(day: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const p = parts(noon);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - noon.getTime()) / 60000);
}

function localDateTime(day: string, time: string | null | undefined) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  const h = Number(m?.[1] || 9), minute = Number(m?.[2] || 0);
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), Math.min(23, Math.max(0, h)), Math.min(59, Math.max(0, minute))) - offsetMinutes(day) * 60000);
}

function workDays(employee: any) {
  try {
    const parsed = JSON.parse(String(employee.workDaysJson || "[]"));
    if (Array.isArray(parsed)) {
      const values = [...new Set(parsed.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))];
      if (values.length) return values;
    }
  } catch {}
  return [0, 1, 2, 3, 4];
}

function rotationActive(employee: any, day: string) {
  const start = String(employee.rotationStartDate || "").slice(0, 10);
  const on = Math.max(1, Math.floor(Number(employee.rotationDaysOn ?? 4)));
  const off = Math.max(0, Math.floor(Number(employee.rotationDaysOff ?? 2)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  const diff = Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  return Number.isFinite(diff) && diff >= 0 && (diff % (on + off)) < on;
}

function currentShift(employee: any, now: Date) {
  const kind = String(employee.scheduleType || "ADMIN").trim().toUpperCase();
  const today = localDay(now);
  const yesterday = localDay(new Date(now.getTime() - 86400000));
  const candidates = [today, yesterday];
  for (const day of candidates) {
    const start = localDateTime(day, employee.workStartTime);
    const startMinutes = (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(employee.workStartTime || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60; })();
    const endMinutes = (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(employee.workEndTime || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : 16 * 60; })();
    const overnight = endMinutes <= startMinutes;
    const end = new Date(start.getTime() + ((overnight ? endMinutes + 1440 : endMinutes) - startMinutes) * 60000);
    const active = kind === "ROTATION" ? rotationActive(employee, day) : workDays(employee).includes(parts(start).weekday);
    if (active && now.getTime() >= start.getTime() && now.getTime() <= end.getTime() + 60000) return { start, end, isWorkDay: true };
  }
  const start = localDateTime(today, employee.workStartTime);
  const startMinutes = (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(employee.workStartTime || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60; })();
  const endMinutes = (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(employee.workEndTime || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : 16 * 60; })();
  const overnight = endMinutes <= startMinutes;
  const end = new Date(start.getTime() + ((overnight ? endMinutes + 1440 : endMinutes) - startMinutes) * 60000);
  const active = kind === "ROTATION" ? rotationActive(employee, today) : workDays(employee).includes(parts(start).weekday);
  return { start, end, isWorkDay: active };
}

async function prepareEmployee(request: Request, env: Env, ctx: ExecutionContext) {
  const actor = await currentUser(request, env, ctx);
  const role = String(actor?.role || "").toLowerCase();
  if (!actor || !["owner", "manager"].includes(role)) {
    return new Response(JSON.stringify({ error: "المالك أو المدير فقط يستطيعان التحضير المباشر" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  const body = await request.json().catch(() => ({})) as any;
  const employeeId = String(body.employeeId || "").trim();
  const type = String(body.type || "check-in");
  if (!employeeId || type !== "check-in") {
    return new Response(JSON.stringify({ error: "بيانات التحضير المباشر غير صحيحة" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if (!employee || employee.status !== "active") {
    return new Response(JSON.stringify({ error: "الموظف غير موجود أو موقوف" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const now = new Date();
  const shift = currentShift(employee, now);
  if (!shift.isWorkDay || now.getTime() < shift.start.getTime() || now.getTime() > shift.end.getTime() + 60000) {
    return new Response(JSON.stringify({ error: "لا توجد مناوبة فعالة لهذا الموظف الآن" }), { status: 409, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  const existing = await env.DB.prepare("SELECT id,type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<=? ORDER BY timestamp DESC LIMIT 200").bind(employee.id, shift.start.toISOString(), new Date(Math.min(shift.end.getTime() + 60000, now.getTime() + 5000)).toISOString()).all<any>();
  const rows = existing.results || [];
  const validRows = rows.filter((row: any) => {
    const ts = Date.parse(String(row.timestamp || ""));
    return Number.isFinite(ts) && ts >= shift.start.getTime() && ts <= now.getTime() + 5000;
  });
  if (validRows.some((row: any) => String(row.type) === "check-in")) {
    return new Response(JSON.stringify({ error: "الموظف مسجل حضور بالفعل في هذه المناوبة" }), { status: 409, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const deviceId = `ADMIN_DIRECT:${role === "manager" ? "المدير" : "المالك"}`;
  await env.DB.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, employee.id, employee.jobNumber, employee.name, "check-in", timestamp, null, null, null, deviceId, "system", "DIRECT_ADMIN", null).run();
  await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), employee.id, employee.jobNumber, actor.name || (role === "manager" ? "المدير" : "المالك"), "check-in", "success", "تحضير مباشر من الإدارة", timestamp, deviceId, "system", null, null, null).run().catch(() => undefined);

  return new Response(JSON.stringify({ ok: true, record: { id, employeeId: employee.id, jobNumber: employee.jobNumber, employeeName: employee.name, type: "check-in", timestamp, deviceId, ip: "system", qrCode: "DIRECT_ADMIN", locationId: null } }), { status: 201, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function sanitizeAttendanceResponse(response: Response) {
  return response.clone().json().then((data: any) => {
    if (!Array.isArray(data)) return response;
    const now = Date.now();
    const safe = data.filter((row: any) => {
      const timestamp = Date.parse(String(row?.timestamp || ""));
      return Number.isFinite(timestamp) && timestamp <= now + 5000;
    });
    return new Response(JSON.stringify(safe), { status: response.status, headers: response.headers });
  }).catch(() => response);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const attendanceGet = (url.pathname === "/api/attendance" || url.pathname === "/api/attendance/") && request.method === "GET";
    const managerPrepare = (url.pathname === "/api/manager/attendance" || url.pathname === "/api/manager/attendance/") && request.method === "POST";
    if (managerPrepare) return prepareEmployee(request, env, ctx);

    const response = await production.fetch(request, env, ctx);
    if (!attendanceGet || !response.ok) return response;
    if (!(await isStaff(request, env, ctx))) return response;
    return sanitizeAttendanceResponse(response);
  },
  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const scheduled = (production as any).scheduled;
    if (typeof scheduled === "function") return scheduled(controller, env, ctx);
  },
};
