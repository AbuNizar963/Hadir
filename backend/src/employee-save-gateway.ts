import base, { HadirRealtime } from "./entry";

type Env = { DB: D1Database; APP_ORIGIN?: string; APP_ORIGINS?: string; JWT_SECRET?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket; REALTIME: DurableObjectNamespace };
type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; name: string; role: Role; username?: string };

const json = (data: unknown, status: number, origin: string) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization, content-type, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "cache-control": "no-store" },
});

function responseOrigin(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = String(env.APP_ORIGIN || env.APP_ORIGINS || "").split(",").map(x => x.trim().replace(/\/$/, "")).filter(Boolean);
  return incoming && (configured.length === 0 || configured.includes(incoming) || /^https:\/\/[^/]+\.pages\.dev$/i.test(incoming)) ? incoming : configured[0] || "*";
}

function tokenFromRequest(request: Request) { return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); }

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  let binary = ""; for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function adminActor(request: Request, env: Env): Promise<Actor | null> {
  const token = tokenFromRequest(request); if (!token) return null;
  try {
    const hash = await hashToken(token);
    const session = await env.DB.prepare("SELECT user_id AS userId,user_type AS userType,role FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(hash).first<any>();
    if (!session || session.userType !== "admin") return null;
    const row = await env.DB.prepare("SELECT id,username,name,role,active FROM admin_accounts WHERE id=? LIMIT 1").bind(session.userId).first<any>();
    if (!row || !row.active || !["owner", "manager", "supervisor"].includes(String(row.role))) return null;
    return { id: String(row.id), username: String(row.username || ""), name: String(row.name || ""), role: row.role as Role };
  } catch { return null; }
}

function employeeOut(row: any) {
  const parse = (value: unknown) => { try { return JSON.parse(String(value || "[]")); } catch { return []; } };
  return {
    id: row.id, jobNumber: row.job_number, name: row.name, pinHash: "", status: row.status,
    deviceId: row.device_id, deviceLabel: row.device_label, createdAt: row.created_at,
    scheduleType: row.schedule_type, rotationStartDate: row.rotation_start_date, avatar: row.avatar || null,
    workStartTime: row.work_start_time, workEndTime: row.work_end_time, gracePeriodMinutes: row.grace_period_minutes,
    role: row.role, locationId: row.location_id, rotationDaysOn: row.rotation_days_on, rotationDaysOff: row.rotation_days_off,
    workDays: parse(row.work_days_json), specialties: parse(row.specialties_json),
    isVip: Boolean(Number(row.is_vip || 0)), autoCheckIn: Boolean(Number(row.auto_check_in || 0)), autoCheckOut: Boolean(Number(row.auto_check_out || 0)),
  };
}

async function handleEmployeePatch(request: Request, env: Env, origin: string) {
  const actor = await adminActor(request, env);
  if (!actor || !["owner", "manager"].includes(actor.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  const id = decodeURIComponent(path.slice("/api/employees/".length));
  if (!id || id.includes("/")) return json({ error: "معرف الموظف غير صحيح" }, 400, origin);
  const current = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
  if (!current) return json({ error: "الموظف غير موجود" }, 404, origin);
  const body = await request.json().catch(() => ({})) as Record<string, any>;
  const sets: string[] = []; const values: any[] = [];

  if (body.jobNumber !== undefined) {
    const value = String(body.jobNumber || "").trim();
    if (!value) return json({ error: "الرقم الوظيفي لا يمكن أن يكون فارغًا" }, 400, origin);
    if (value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) return json({ error: "الرقم الوظيفي غير صالح" }, 400, origin);
    const duplicate = await env.DB.prepare("SELECT id FROM employees WHERE job_number=? AND id<>? LIMIT 1").bind(value, id).first<any>();
    if (duplicate) return json({ error: "الرقم الوظيفي مستخدم من موظف آخر" }, 409, origin);
    sets.push("job_number=?"); values.push(value);
  }

  const fields: Record<string, string> = {
    name: "name", status: "status", scheduleType: "schedule_type", rotationStartDate: "rotation_start_date",
    workStartTime: "work_start_time", workEndTime: "work_end_time", gracePeriodMinutes: "grace_period_minutes",
    locationId: "location_id", rotationDaysOn: "rotation_days_on", rotationDaysOff: "rotation_days_off", avatar: "avatar",
    isVip: "is_vip", autoCheckIn: "auto_check_in", autoCheckOut: "auto_check_out",
  };
  for (const [key, column] of Object.entries(fields)) {
    if (body[key] === undefined) continue;
    let value = body[key];
    if (["gracePeriodMinutes", "rotationDaysOn", "rotationDaysOff"].includes(key)) value = Number(value);
    if (["isVip", "autoCheckIn", "autoCheckOut"].includes(key)) {
      if (typeof value !== "boolean") return json({ error: `القيمة ${key} يجب أن تكون true أو false` }, 400, origin);
      value = value ? 1 : 0;
    }
    if (["rotationStartDate", "workStartTime", "workEndTime", "locationId"].includes(key) && value === "") value = null;
    sets.push(`${column}=?`); values.push(value);
  }
  if (body.pin !== undefined || body.password !== undefined) {
    const pin = String(body.pin ?? body.password ?? "");
    if (pin && pin.length < 4) return json({ error: "رمز PIN يجب أن يتكون من 4 أحرف/أرقام على الأقل" }, 400, origin);
    if (pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
      let binary = ""; for (const byte of new Uint8Array(bits)) binary += String.fromCharCode(byte);
      const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      let saltBinary = ""; for (const byte of salt) saltBinary += String.fromCharCode(byte);
      const salt64 = btoa(saltBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      sets.push("pin_hash=?"); values.push(`pbkdf2$100000$${salt64}$${b64}`);
    }
  }
  if (body.specialties !== undefined) { sets.push("specialties_json=?"); values.push(JSON.stringify(Array.isArray(body.specialties) ? body.specialties : [])); }
  if (body.workDays !== undefined) { sets.push("work_days_json=?"); values.push(JSON.stringify(Array.isArray(body.workDays) ? body.workDays : [])); }

  if (!sets.length) return json({ ok: true, employee: employeeOut(current) }, 200, origin);
  values.push(id);
  try {
    const result = await env.DB.prepare(`UPDATE employees SET ${sets.join(",")} WHERE id=?`).bind(...values).run();
    if (!result.meta.changes) return json({ error: "لم يتم تعديل أي سجل في D1" }, 409, origin);
    const saved = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
    if (!saved) return json({ error: "تم التحديث لكن تعذر قراءة الموظف من D1" }, 500, origin);
    return json({ ok: true, employee: employeeOut(saved) }, 200, origin);
  } catch (error) {
    return json({ error: "تعذر تحديث بيانات الموظف في D1", detail: error instanceof Error ? error.message : String(error) }, 409, origin);
  }
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const origin = responseOrigin(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization, content-type, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "cache-control": "no-store" } });
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (request.method === "PATCH" && path.startsWith("/api/employees/") && !path.endsWith("/device") && !path.endsWith("/avatar") && !path.endsWith("/checkout-policy")) return handleEmployeePatch(request, env, origin);
    return base.fetch(request, env, ctx);
  },
};
