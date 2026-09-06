import production from "./attendance-production-gateway";

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

async function prepareEmployee(request: Request, env: Env, ctx: ExecutionContext) {
  const actor = await currentUser(request, env, ctx);
  if (!actor || String(actor.role).toLowerCase() !== "owner") {
    return new Response(JSON.stringify({ error: "المالك فقط يستطيع التحضير المباشر" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  const body = await request.json().catch(() => ({})) as any;
  const employeeId = String(body.employeeId || "").trim();
  const type = String(body.type || "check-in");
  if (!employeeId || type !== "check-in") {
    return new Response(JSON.stringify({ error: "بيانات التحضير المباشر غير صحيحة" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if (!employee || employee.status !== "active") {
    return new Response(JSON.stringify({ error: "الموظف غير موجود أو موقوف" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const now = new Date();
  const start = dayStart(localDay(now));
  const next = start + 86400000;
  const existing = await env.DB.prepare("SELECT id,type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<? ORDER BY timestamp DESC LIMIT 200").bind(employee.id, new Date(start).toISOString(), new Date(next).toISOString()).all<any>();
  const rows = existing.results || [];
  if (rows.some((row: any) => String(row.type) === "check-in")) {
    return new Response(JSON.stringify({ error: "الموظف مسجل حضور بالفعل لهذا اليوم" }), { status: 409, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const deviceId = "ADMIN_DIRECT:المالك";
  await env.DB.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, employee.id, employee.jobNumber, employee.name, "check-in", timestamp, null, null, null, deviceId, "system", "DIRECT_ADMIN", null).run();
  await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), employee.id, employee.jobNumber, actor.name || "المالك", "check-in", "success", "تحضير مباشر من الإدارة", timestamp, deviceId, "system", null, null, null).run().catch(() => undefined);

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
