type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; username: string; name: string; role: Role };
type Env = { DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string };

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100000;

function b64(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}
async function verifyPassword(password: string, stored: string) {
  try {
    const [kind, iterationsText, saltText, hashText] = String(stored || "").split("$");
    const iterations = Number(iterationsText);
    if (kind !== "pbkdf2" || iterations !== PASSWORD_ITERATIONS || !saltText || !hashText) return false;
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(saltText), iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
    return b64(bits) === hashText;
  } catch { return false; }
}

async function sign(actor: Actor, secret: string) {
  if (!secret) throw new Error("JWT_SECRET is missing");
  const header = b64(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64(encoder.encode(JSON.stringify({ ...actor, exp: Math.floor(Date.now() / 1000) + 43200 })));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64(signature)}`;
}

async function readToken(req: Request, env: Env) : Promise<Actor | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.JWT_SECRET) return null;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, unb64(signature), encoder.encode(`${header}.${payload}`));
    if (!valid) return null;
    const actor = JSON.parse(new TextDecoder().decode(unb64(payload))) as Actor & { exp?: number };
    if (!actor.exp || actor.exp < Math.floor(Date.now() / 1000)) return null;
    if (actor.id === "bootstrap") {
      const owner = await env.DB.prepare("SELECT id FROM admin_accounts WHERE role='owner' LIMIT 1").first();
      if (owner) return null;
    }
    return { id: actor.id, username: actor.username, name: actor.name, role: actor.role };
  } catch { return null; }
}

const cors = (origin: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origin,
  "access-control-allow-headers": "content-type, authorization, x-device-id",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-max-age": "86400",
});
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: cors(origin) });
const body = async (req: Request) => await req.json().catch(() => ({})) as Record<string, any>;
const isAdmin = (role: Role) => ["owner", "manager", "supervisor"].includes(role);
const canWrite = (role: Role) => ["owner", "manager"].includes(role);
const isOwner = (role: Role) => role === "owner";

let schemaReady: Promise<void> | null = null;
async function ensureSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','manager','supervisor')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS employees(id TEXT PRIMARY KEY,job_number TEXT NOT NULL UNIQUE,name TEXT NOT NULL,pin_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',device_id TEXT,device_label TEXT,created_at TEXT NOT NULL,schedule_type TEXT NOT NULL DEFAULT 'ADMIN',rotation_start_date TEXT,work_start_time TEXT,work_end_time TEXT,grace_period_minutes INTEGER NOT NULL DEFAULT 10,role TEXT NOT NULL DEFAULT 'staff',location_id TEXT,rotation_days_on INTEGER,rotation_days_off INTEGER,specialties_json TEXT NOT NULL DEFAULT '[]',work_days_json TEXT NOT NULL DEFAULT '[]',avatar TEXT)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS locations(id TEXT PRIMARY KEY,name TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,radius_meters REAL NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,job_number TEXT NOT NULL,employee_name TEXT NOT NULL,type TEXT NOT NULL,timestamp TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,distance_meters REAL NOT NULL,device_id TEXT NOT NULL,ip TEXT NOT NULL,qr_code TEXT NOT NULL,location_id TEXT)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,employee_name TEXT NOT NULL,job_number TEXT NOT NULL,type TEXT NOT NULL,reason TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,employee_id TEXT,job_number TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,reason TEXT,timestamp TEXT NOT NULL,device_id TEXT NOT NULL,ip TEXT NOT NULL,lat REAL,lng REAL,distance_meters REAL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)"),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner ON admin_accounts(role) WHERE role='owner'"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_employee_time ON attendance(employee_id,timestamp DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(timestamp DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit(timestamp DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)"),
    ]).then(() => undefined).catch(error => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

async function ownerExists(env: Env) {
  const row = await env.DB.prepare("SELECT 1 AS ok FROM admin_accounts WHERE role='owner' LIMIT 1").first<{ ok: number }>();
  return Boolean(row);
}
function arr(value: unknown) { try { return JSON.parse(String(value || "[]")); } catch { return []; } }
function employeeOut(r: any) {
  return {
    id: r.id, jobNumber: r.job_number, name: r.name, pinHash: "", status: r.status,
    deviceId: r.device_id, deviceLabel: r.device_label, createdAt: r.created_at,
    scheduleType: r.schedule_type, rotationStartDate: r.rotation_start_date, avatar: r.avatar || null,
    workStartTime: r.work_start_time, workEndTime: r.work_end_time, gracePeriodMinutes: r.grace_period_minutes,
    role: r.role, locationId: r.location_id, rotationDaysOn: r.rotation_days_on, rotationDaysOff: r.rotation_days_off,
    workDays: arr(r.work_days_json), specialties: arr(r.specialties_json),
  };
}
async function audit(env: Env, req: Request, actorName: string, action: string, result: "success" | "rejected", employeeId: string | null = null, jobNumber = "", reason: string | null = null) {
  await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(uid(), employeeId, jobNumber, actorName, action, result, reason, now(), req.headers.get("x-device-id") || "unknown", req.headers.get("CF-Connecting-IP") || "unknown").run().catch(() => undefined);
}

export default {
  async fetch(req: Request, env: Env) {
    const origin = env.APP_ORIGIN || "*";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const path = new URL(req.url).pathname.replace(/\/$/, "") || "/";
    try {
      if (!env.DB) return json({ ok: false, error: "D1 binding DB غير موجود" }, 503, origin);
      await ensureSchema(env);

      if (path === "/" && req.method === "GET") return json({ ok: true, service: "hadir-api", message: "Hadir API is running" }, 200, origin);
      if (path === "/api/health" && req.method === "GET") {
        await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: true, service: "hadir-api", database: "D1", ownerInitialized: await ownerExists(env), time: now() }, 200, origin);
      }
      if (path === "/api/bootstrap" && req.method === "GET") {
        if (await ownerExists(env)) return json({ bootstrap: false }, 200, origin);
        const token = await sign({ id: "bootstrap", username: "", name: "إعداد النظام", role: "owner" }, env.JWT_SECRET || "");
        return json({ bootstrap: true, token }, 200, origin);
      }
      if (path === "/api/bootstrap/owner" && req.method === "POST") {
        if (await ownerExists(env)) return json({ error: "تم إعداد حساب المالك مسبقًا" }, 409, origin);
        const bootstrapActor = await readToken(req, env);
        if (!bootstrapActor || bootstrapActor.id !== "bootstrap") return json({ error: "جلسة الإعداد غير صالحة" }, 401, origin);
        const b = await body(req);
        const name = String(b.name || "").trim();
        const username = String(b.username || "").trim();
        const password = String(b.password || "");
        if (!name || !username || password.length < 6) return json({ error: "اسم المالك واسم المستخدم وكلمة المرور (6 أحرف على الأقل) مطلوبة" }, 400, origin);
        try {
          const id = uid();
          await env.DB.prepare("INSERT INTO admin_accounts(id,username,password_hash,name,role,active,created_at) VALUES(?,?,?,?,?,?,?)")
            .bind(id, username, await hashPassword(password), name, "owner", 1, now()).run();
          const actor: Actor = { id, username, name, role: "owner" };
          return json({ token: await sign(actor, env.JWT_SECRET || ""), user: actor, kind: "admin" }, 201, origin);
        } catch (error) {
          return json({ error: "تعذر إنشاء حساب المالك في قاعدة D1", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
        }
      }

      if (path === "/api/auth/login" && req.method === "POST") {
        const b = await body(req);
        const username = String(b.username || "").trim();
        const password = String(b.password || "");
        if (!username || !password) return json({ error: "اسم المستخدم وكلمة المرور مطلوبان" }, 400, origin);
        const admin = await env.DB.prepare("SELECT * FROM admin_accounts WHERE username=? LIMIT 1").bind(username).first<any>();
        if (admin?.active && await verifyPassword(password, admin.password_hash)) {
          const actor: Actor = { id: admin.id, username: admin.username, name: admin.name, role: admin.role };
          await audit(env, req, admin.name, `${admin.role}-login`, "success", null, username);
          return json({ token: await sign(actor, env.JWT_SECRET || ""), user: actor, kind: "admin" }, 200, origin);
        }
        const employee = await env.DB.prepare("SELECT * FROM employees WHERE job_number=? LIMIT 1").bind(username).first<any>();
        if (!employee || employee.status !== "active" || !(await verifyPassword(password, employee.pin_hash))) {
          await audit(env, req, username, "login-failed", "rejected", employee?.id || null, username, "invalid credentials");
          return json({ error: "رقم الموظف أو رمز PIN غير صحيح" }, 401, origin);
        }
        const device = String(b.deviceId || req.headers.get("x-device-id") || "");
        if (device && employee.device_id && device !== employee.device_id) return json({ error: "هذا الحساب مرتبط بجهاز آخر. اطلب من الإدارة إعادة تعيين الجهاز." }, 403, origin);
        if (device && !employee.device_id) {
          await env.DB.prepare("UPDATE employees SET device_id=? WHERE id=?").bind(device, employee.id).run();
          await audit(env, req, employee.name, "device-bound", "success", employee.id, employee.job_number);
        }
        const actor: Actor = { id: employee.id, username: employee.job_number, name: employee.name, role: "staff" };
        await audit(env, req, employee.name, "login", "success", employee.id, employee.job_number);
        return json({ token: await sign(actor, env.JWT_SECRET || ""), user: employeeOut(employee), kind: "employee" }, 200, origin);
      }

      const actor = await readToken(req, env);
      if (!actor) return json({ error: "غير مصرح" }, 401, origin);
      if (path === "/api/me" && req.method === "GET") return json({ user: actor }, 200, origin);

      if (path === "/api/employee-location" && req.method === "GET") {
        if (actor.role !== "staff") return json({ error: "هذا المسار مخصص للموظفين" }, 403, origin);
        const employee = await env.DB.prepare("SELECT location_id FROM employees WHERE id=? AND status='active' LIMIT 1").bind(actor.id).first<{ location_id: string | null }>();
        if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);
        let location: any = null;
        if (employee.location_id) {
          location = await env.DB.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations WHERE id=? LIMIT 1").bind(employee.location_id).first<any>();
        }
        // owner configured main site is authoritative for employees without an explicit branch.
        if (!location) {
          const rows = await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('workSiteLat','workSiteLng','radiusMeters')").all<{key:string,value:string}>();
          const main: Record<string, any> = {};
          for (const row of rows.results) { try { main[row.key] = JSON.parse(row.value); } catch { main[row.key] = row.value; } }
          const lat = Number(main.workSiteLat);
          const lng = Number(main.workSiteLng);
          const radiusMeters = Number(main.radiusMeters);
          if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMeters) && radiusMeters >= 0) {
            location = { id: 'main', name: 'المقر الرئيسي', lat, lng, radiusMeters };
          }
        }
        if (!location) location = await env.DB.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name LIMIT 1").first<any>();
        if (!location) return json({ error: "لا يوجد موقع حضور مضبوط في قاعدة البيانات" }, 404, origin);
        return json({ location }, 200, origin);
      }

      if (path === "/api/admins" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const rows = await env.DB.prepare("SELECT id,username,name,role,active,created_at AS createdAt FROM admin_accounts ORDER BY name").all<any>();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/admins" && req.method === "POST") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        const b = await body(req); const username = String(b.username || "").trim(); const name = String(b.name || "").trim(); const password = String(b.password || ""); const role = String(b.role || "");
        if (!username || !name || password.length < 6 || !["manager", "supervisor"].includes(role)) return json({ error: "بيانات الحساب غير مكتملة" }, 400, origin);
        try { await env.DB.prepare("INSERT INTO admin_accounts(id,username,password_hash,name,role,active,created_at) VALUES(?,?,?,?,?,?,?)").bind(uid(), username, await hashPassword(password), name, role, 1, now()).run(); return json({ ok: true }, 201, origin); }
        catch (error) { return json({ error: "تعذر إنشاء الحساب", detail: error instanceof Error ? error.message : String(error) }, 409, origin); }
      }
      if (path.startsWith("/api/admins/") && req.method === "PATCH") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        const id = decodeURIComponent(path.split("/").pop() || ""); const b = await body(req);
        if (b.password) await env.DB.prepare("UPDATE admin_accounts SET password_hash=? WHERE id=? AND role!='owner'").bind(await hashPassword(String(b.password)), id).run();
        if (b.name !== undefined || b.active !== undefined) await env.DB.prepare("UPDATE admin_accounts SET name=COALESCE(?,name),active=COALESCE(?,active) WHERE id=? AND role!='owner'").bind(b.name ?? null, b.active === undefined ? null : (b.active ? 1 : 0), id).run();
        return json({ ok: true }, 200, origin);
      }
      if (path.startsWith("/api/admins/") && req.method === "DELETE") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        await env.DB.prepare("DELETE FROM admin_accounts WHERE id=? AND role!='owner'").bind(decodeURIComponent(path.split("/").pop() || "")).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/employees" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const rows = await env.DB.prepare("SELECT * FROM employees ORDER BY name").all<any>();
        return json(rows.results.map(employeeOut), 200, origin);
      }
      if (path === "/api/employees" && req.method === "POST") {
        if (!canWrite(actor.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
        const b = await body(req); const jobNumber = String(b.jobNumber || "").trim(); const name = String(b.name || "").trim(); const pin = String(b.pin || b.password || "");
        if (!jobNumber || !name || pin.length < 4) return json({ error: "رقم الموظف والاسم ورمز PIN مطلوبة" }, 400, origin);
        try {
          const employeeId = String(b.id || uid());
          await env.DB.prepare("INSERT INTO employees(id,job_number,name,pin_hash,status,device_id,device_label,created_at,schedule_type,rotation_start_date,work_start_time,work_end_time,grace_period_minutes,role,location_id,rotation_days_on,rotation_days_off,specialties_json,work_days_json,avatar) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(employeeId, jobNumber, name, await hashPassword(pin), b.status || "active", b.deviceId || null, b.deviceLabel || null, now(), b.scheduleType || "ADMIN", b.rotationStartDate || null, b.workStartTime || null, b.workEndTime || null, Number(b.gracePeriodMinutes ?? 10), b.role || "staff", b.locationId || null, b.rotationDaysOn ?? null, b.rotationDaysOff ?? null, JSON.stringify(b.specialties || []), JSON.stringify(b.workDays || []), b.avatar || null).run();
          const employee = await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(employeeId).first<any>();
          return json({ ok: true, employee: employeeOut(employee) }, 201, origin);
        } catch (error) { return json({ error: "تعذر إنشاء الموظف", detail: error instanceof Error ? error.message : String(error) }, 409, origin); }
      }
      if (path.startsWith("/api/employees/") && req.method === "PATCH" && !path.endsWith("/device")) {
        if (!canWrite(actor.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
        const id = decodeURIComponent(path.split("/").pop() || ""); const b = await body(req); const sets: string[] = []; const values: any[] = [];
        const map: Record<string,string> = { jobNumber: "job_number", name: "name", status: "status", deviceLabel: "device_label", scheduleType: "schedule_type", rotationStartDate: "rotation_start_date", workStartTime: "work_start_time", workEndTime: "work_end_time", gracePeriodMinutes: "grace_period_minutes", role: "role", locationId: "location_id", rotationDaysOn: "rotation_days_on", rotationDaysOff: "rotation_days_off", avatar: "avatar" };
        for (const [key, column] of Object.entries(map)) if (b[key] !== undefined) { sets.push(`${column}=?`); values.push(b[key] === "" ? null : b[key]); }
        if (b.pin !== undefined) { sets.push("pin_hash=?"); values.push(await hashPassword(String(b.pin))); }
        if (b.specialties !== undefined) { sets.push("specialties_json=?"); values.push(JSON.stringify(b.specialties || [])); }
        if (b.workDays !== undefined) { sets.push("work_days_json=?"); values.push(JSON.stringify(b.workDays || [])); }
        if (!sets.length) return json({ ok: true }, 200, origin);
        values.push(id); await env.DB.prepare(`UPDATE employees SET ${sets.join(",")} WHERE id=?`).bind(...values).run();
        const employee = await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first<any>();
        return employee ? json({ ok: true, employee: employeeOut(employee) }, 200, origin) : json({ error: "الموظف غير موجود" }, 404, origin);
      }
      if (path.startsWith("/api/employees/") && path.endsWith("/device") && req.method === "DELETE") {
        if (!canWrite(actor.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
        await env.DB.prepare("UPDATE employees SET device_id=NULL,device_label=NULL WHERE id=?").bind(decodeURIComponent(path.split("/")[3] || "")).run();
        return json({ ok: true }, 200, origin);
      }
      if (path.startsWith("/api/employees/") && req.method === "DELETE") {
        if (!canWrite(actor.role)) return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
        await env.DB.prepare("DELETE FROM employees WHERE id=?").bind(decodeURIComponent(path.split("/").pop() || "")).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/attendance" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") || 500), 1), 2000);
        const rows = await env.DB.prepare("SELECT id,employee_id AS employeeId,job_number AS jobNumber,employee_name AS employeeName,type,timestamp,lat,lng,distance_meters AS distanceMeters,device_id AS deviceId,ip,qr_code AS qrCode,location_id AS locationId FROM attendance ORDER BY timestamp DESC LIMIT ?").bind(limit).all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/attendance" && req.method === "POST") {
        if (actor.role !== "staff") return json({ error: "هذا المسار مخصص للموظفين" }, 403, origin);
        const b = await body(req); const employee = await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(actor.id).first<any>();
        if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);
        const type = String(b.type || ""); if (!['check-in','check-out'].includes(type)) return json({ error: "نوع الحضور غير صحيح" }, 400, origin);
        await env.DB.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(uid(), employee.id, employee.job_number, employee.name, type, b.timestamp || now(), Number(b.lat || 0), Number(b.lng || 0), Number(b.distanceMeters || 0), String(b.deviceId || req.headers.get("x-device-id") || "unknown"), req.headers.get("CF-Connecting-IP") || "unknown", String(b.qrCode || ""), b.locationId || null).run();
        await audit(env, req, employee.name, type, "success", employee.id, employee.job_number);
        return json({ ok: true }, 201, origin);
      }

      if (path === "/api/requests" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const rows = await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests ORDER BY created_at DESC").all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/requests" && req.method === "POST") {
        if (actor.role !== "staff") return json({ error: "غير مصرح" }, 403, origin);
        const b = await body(req); await env.DB.prepare("INSERT INTO requests(id,employee_id,employee_name,job_number,type,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(uid(), actor.id, actor.name, actor.username, String(b.type || "permission"), b.reason || "", "pending", now()).run();
        return json({ ok: true }, 201, origin);
      }
      if (path.startsWith("/api/requests/") && req.method === "PATCH") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const b = await body(req); if (!['approved','rejected'].includes(String(b.status))) return json({ error: "الحالة غير صحيحة" }, 400, origin);
        await env.DB.prepare("UPDATE requests SET status=? WHERE id=?").bind(String(b.status), decodeURIComponent(path.split("/").pop() || "")).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/audit" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") || 500), 1), 2000);
        const rows = await env.DB.prepare("SELECT id,employee_id AS employeeId,job_number AS jobNumber,actor_name AS actorName,action,result,reason,timestamp,device_id AS deviceId,ip,lat,lng,distance_meters AS distanceMeters FROM audit ORDER BY timestamp DESC LIMIT ?").bind(limit).all();
        return json(rows.results, 200, origin);
      }

      if (path === "/api/settings" && req.method === "GET") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        const rows = await env.DB.prepare("SELECT key,value FROM settings").all<{key:string,value:string}>();
        const settings: Record<string, any> = {};
        for (const row of rows.results) { try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; } }
        const admins = await env.DB.prepare("SELECT id,username,name,role,active,created_at AS createdAt FROM admin_accounts ORDER BY name").all();
        settings.adminAccounts = admins.results;
        return json(settings, 200, origin);
      }
      if (path === "/api/settings" && req.method === "PUT") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        const settings = await body(req);
        const statements = Object.entries(settings).filter(([key]) => key !== "adminAccounts" && key !== "ownerPasswordHash" && key !== "managerPasswordHash" && key !== "supervisorPasswordHash").map(([key,value]) => env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, JSON.stringify(value)));
        if (statements.length) await env.DB.batch(statements);
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/locations" && req.method === "GET") {
        if (!isAdmin(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
        const rows = await env.DB.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name").all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/locations" && req.method === "PUT") {
        if (!isOwner(actor.role)) return json({ error: "المالك فقط" }, 403, origin);
        const b = await body(req); const id = String(b.id || uid());
        await env.DB.prepare("INSERT INTO locations(id,name,lat,lng,radius_meters) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lng=excluded.lng,radius_meters=excluded.radius_meters")
          .bind(id, String(b.name || "موقع"), Number(b.lat || 0), Number(b.lng || 0), Number(b.radiusMeters || 100)).run();
        return json({ ok: true }, 200, origin);
      }

      return json({ error: "المسار غير موجود" }, 404, origin);
    } catch (error) {
      console.error("Hadir API error", error);
      return json({ error: "خطأ داخلي بالخادم", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
    }
  },
};
