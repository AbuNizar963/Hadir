import base, { HadirRealtime } from "./device-rebind-gateway";
import { generateDailyReportPdf } from "./report-pdf";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  BROWSER?: BrowserRun;
};

type Actor = { id: string; name: string; role: "owner" | "manager" | "supervisor" | "staff" };

const SESSION_COOKIE = "hadir_session";
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization, x-device-id",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "cache-control": "no-store",
  },
});

function origin(req: Request, env: Env) {
  const incoming = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = String(env.APP_ORIGIN || env.APP_ORIGINS || "").split(",").map(v => v.trim().replace(/\/$/, "")).filter(Boolean);
  if (incoming && configured.includes(incoming)) return incoming;
  if (!configured.length && incoming && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming)) return incoming;
  return configured[0] || "*";
}

function token(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const item = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`));
  return item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) : (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function actor(req: Request, env: Env): Promise<Actor | null> {
  const raw = token(req);
  if (!raw) return null;
  try {
    const hash = await sha256(raw);
    const session = await env.DB.prepare("SELECT user_id AS userId,user_type AS userType FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(hash).first<any>();
    if (!session || session.userType !== "admin") return null;
    const row = await env.DB.prepare("SELECT id,name,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(session.userId).first<any>();
    return row ? { id: String(row.id), name: String(row.name || ""), role: row.role } : null;
  } catch { return null; }
}

async function ensurePolicyTable(env: Env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS employee_checkout_policies(employee_id TEXT PRIMARY KEY,early_checkout_minutes INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)").run();
}

function employeeOut(row: any, policyMinutes = 0) {
  let specialties: string[] = [];
  let workDays: number[] = [];
  try { specialties = JSON.parse(String(row.specialties_json || "[]")); } catch {}
  try { workDays = JSON.parse(String(row.work_days_json || "[]")); } catch {}
  return {
    id: String(row.id), jobNumber: String(row.job_number || ""), name: String(row.name || ""), pinHash: "", status: row.status,
    deviceId: row.device_id, deviceLabel: row.device_label, createdAt: row.created_at, scheduleType: row.schedule_type,
    rotationStartDate: row.rotation_start_date, avatar: row.avatar || null, workStartTime: row.work_start_time, workEndTime: row.work_end_time,
    gracePeriodMinutes: Number(row.grace_period_minutes ?? 0), earlyCheckoutGraceMinutes: policyMinutes,
    role: row.role, locationId: row.location_id, rotationDaysOn: row.rotation_days_on, rotationDaysOff: row.rotation_days_off,
    specialties, workDays, isVip: Boolean(row.is_vip), autoCheckIn: Boolean(row.auto_check_in), autoCheckOut: Boolean(row.auto_check_out),
  };
}

async function saveEmployee(req: Request, env: Env, id: string, a: Actor, o: string) {
  if (!["owner", "manager"].includes(a.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, o);
  const body = await req.json().catch(() => ({})) as Record<string, any>;
  const current = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
  if (!current) return json({ error: "الموظف غير موجود" }, 404, o);

  const sets: string[] = [];
  const values: any[] = [];
  const textMap: Record<string, string> = {
    name: "name", status: "status", scheduleType: "schedule_type", rotationStartDate: "rotation_start_date",
    workStartTime: "work_start_time", workEndTime: "work_end_time", role: "role", locationId: "location_id",
  };
  for (const [key, column] of Object.entries(textMap)) if (body[key] !== undefined) { sets.push(`${column}=?`); values.push(body[key] === "" ? null : body[key]); }
  if (body.gracePeriodMinutes !== undefined) { const n = Number(body.gracePeriodMinutes); if (!Number.isInteger(n) || n < 0 || n > 180) return json({ error: "مهلة التأخر يجب أن تكون بين 0 و180 دقيقة" }, 400, o); sets.push("grace_period_minutes=?"); values.push(n); }
  if (body.rotationDaysOn !== undefined) { const n = Number(body.rotationDaysOn); if (!Number.isInteger(n) || n < 1 || n > 31) return json({ error: "أيام المناوبة غير صحيحة" }, 400, o); sets.push("rotation_days_on=?"); values.push(n); }
  if (body.rotationDaysOff !== undefined) { const n = Number(body.rotationDaysOff); if (!Number.isInteger(n) || n < 0 || n > 31) return json({ error: "أيام الراحة غير صحيحة" }, 400, o); sets.push("rotation_days_off=?"); values.push(n); }
  if (body.specialties !== undefined) { sets.push("specialties_json=?"); values.push(JSON.stringify(Array.isArray(body.specialties) ? body.specialties : [])); }
  if (body.workDays !== undefined) { sets.push("work_days_json=?"); values.push(JSON.stringify(Array.isArray(body.workDays) ? body.workDays : [])); }
  if (body.jobNumber !== undefined) {
    const job = String(body.jobNumber || "").trim();
    if (!job) return json({ error: "الرقم الوظيفي لا يمكن أن يكون فارغًا" }, 400, o);
    const duplicate = await env.DB.prepare("SELECT id FROM employees WHERE job_number=? AND id<>? LIMIT 1").bind(job, id).first<any>();
    if (duplicate) return json({ error: "الرقم الوظيفي مستخدم من موظف آخر" }, 409, o);
    sets.push("job_number=?"); values.push(job);
  }
  if (body.pin !== undefined || body.password !== undefined) {
    const password = String(body.pin ?? body.password ?? "");
    if (password.length < 4) return json({ error: "رمز PIN يجب أن يكون 4 محارف على الأقل" }, 400, o);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
    const b64 = (data: ArrayBuffer | Uint8Array) => { let s = ""; for (const b of new Uint8Array(data)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); };
    sets.push("pin_hash=?"); values.push(`pbkdf2$100000$${b64(salt)}$${b64(bits)}`);
  }
  if (body.isVip !== undefined) { sets.push("is_vip=?"); values.push(body.isVip ? 1 : 0); }
  if (body.autoCheckIn !== undefined) { sets.push("auto_check_in=?"); values.push(body.autoCheckIn ? 1 : 0); }
  if (body.autoCheckOut !== undefined) { sets.push("auto_check_out=?"); values.push(body.autoCheckOut ? 1 : 0); }

  await ensurePolicyTable(env);
  if (body.earlyCheckoutGraceMinutes !== undefined) {
    const n = Number(body.earlyCheckoutGraceMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 180) return json({ error: "مهلة الانصراف المبكر يجب أن تكون بين 0 و180 دقيقة" }, 400, o);
    await env.DB.prepare("INSERT INTO employee_checkout_policies(employee_id,early_checkout_minutes,updated_at) VALUES(?,?,?) ON CONFLICT(employee_id) DO UPDATE SET early_checkout_minutes=excluded.early_checkout_minutes,updated_at=excluded.updated_at").bind(id, n, now()).run();
  }
  if (!sets.length && body.earlyCheckoutGraceMinutes === undefined) return json({ ok: true, employee: employeeOut(current) }, 200, o);

  if (sets.length) {
    try { await env.DB.prepare(`UPDATE employees SET ${sets.join(",")} WHERE id=?`).bind(...values, id).run(); }
    catch (error) { return json({ error: "تعذر تحديث بيانات الموظف", detail: error instanceof Error ? error.message : String(error) }, 409, o); }
  }
  const updated = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
  const policy = await env.DB.prepare("SELECT early_checkout_minutes AS minutes FROM employee_checkout_policies WHERE employee_id=? LIMIT 1").bind(id).first<any>();
  const result = employeeOut(updated, Number(policy?.minutes || 0));
  if (body.isVip !== undefined || body.autoCheckIn !== undefined || body.autoCheckOut !== undefined) {
    await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, result.jobNumber, a.name, "workforce-controls", "success", "تحديث إعدادات الموظف من لوحة الموظفين", now(), req.headers.get("x-device-id") || "OWNER_PANEL", req.headers.get("CF-Connecting-IP") || "unknown").run().catch(() => undefined);
  }
  return json({ ok: true, employee: result }, 200, o);
}

export { HadirRealtime };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const o = origin(req, env);
    const url = new URL(req.url);
    if (url.pathname.replace(/\/$/, "") === "/api/reports/daily/pdf") {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": o,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "content-type, authorization, x-device-id",
        "access-control-allow-methods": "POST,OPTIONS",
        "cache-control": "no-store",
      }});
      const a = await actor(req, env);
      if (!a) return json({ error: "غير مصرح" }, 401, o);
      return generateDailyReportPdf(req, env, o);
    }
    const match = url.pathname.match(/^\/api\/employees\/([^/]+)$/);
    if (match && req.method === "PATCH") {
      const a = await actor(req, env);
      if (!a) return json({ error: "غير مصرح" }, 401, o);
      return saveEmployee(req, env, decodeURIComponent(match[1]), a, o);
    }
    return base.fetch(req, env, ctx);
  },
  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const scheduled = (base as any).scheduled;
    if (typeof scheduled === "function") return scheduled(controller, env, ctx);
  },
};
