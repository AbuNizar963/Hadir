type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  OWNER_USERNAME?: string;
  OWNER_PASSWORD?: string;
  APP_ORIGIN?: string;
};

type Role = "owner" | "manager" | "supervisor";

const json = (data: unknown, status = 200, origin = "*") =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    },
  });

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const s = atob(padded);
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return `${bytesToBase64Url(salt)}.${bytesToBase64Url(bits)}`;
}

async function verifyPassword(password: string, stored: string) {
  const [saltText, hash] = stored.split(".");
  if (!saltText || !hash) return false;
  const derived = await derivePassword(password, base64UrlToBytes(saltText));
  return derived.split(".")[1] === hash;
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return derivePassword(password, salt);
}

async function signToken(payload: { id: string; username: string; role: Role; name: string }, secret: string) {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${bytesToBase64Url(sig)}`;
}

async function auth(request: Request, env: Env): Promise<{ id: string; username: string; role: Role; name: string } | null> {
  const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!value || !env.JWT_SECRET) return null;
  const [header, body, signature] = value.split(".");
  if (!header || !body || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as { id: string; username: string; role: Role; name: string; exp: number };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, username: payload.username, role: payload.role, name: payload.name };
  } catch { return null; }
}

function canWrite(role: Role) { return role === "owner" || role === "manager"; }
function canManageAdmins(role: Role) { return role === "owner"; }

async function ensureOwner(env: Env) {
  const exists = await env.DB.prepare("SELECT id FROM admin_accounts WHERE role='owner' LIMIT 1").first();
  if (exists) return;
  if (!env.OWNER_USERNAME || !env.OWNER_PASSWORD) return;
  const passwordHash = await hashPassword(env.OWNER_PASSWORD);
  await env.DB.prepare("INSERT INTO admin_accounts (id,username,password_hash,name,role,active,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id(), env.OWNER_USERNAME, passwordHash, "المالك", "owner", 1, now()).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.APP_ORIGIN || "*";
    if (request.method === "OPTIONS") return json({}, 204, origin);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    try {
      await ensureOwner(env);

      if (path === "/api/health") return json({ ok: true, service: "hadir-api", time: now() }, 200, origin);

      if (path === "/api/auth/login" && request.method === "POST") {
        const body = await request.json() as { username?: string; password?: string };
        const account = await env.DB.prepare("SELECT id,username,password_hash,name,role,active FROM admin_accounts WHERE username=? LIMIT 1").bind((body.username || "").trim()).first<any>();
        if (!account || !account.active || !(await verifyPassword(body.password || "", account.password_hash))) return json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 401, origin);
        const role = account.role as Role;
        const token = await signToken({ id: account.id, username: account.username, role, name: account.name }, env.JWT_SECRET);
        await env.DB.prepare("INSERT INTO audit (id,employee_id,job_number,actor_name,action,result,timestamp,device_id,ip) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(id(), null, "", account.name, `${role}-login`, "success", now(), "admin", request.headers.get("CF-Connecting-IP") || "unknown").run();
        return json({ token, user: { id: account.id, username: account.username, name: account.name, role } }, 200, origin);
      }

      const actor = await auth(request, env);
      if (!actor) return json({ error: "غير مصرح" }, 401, origin);

      if (path === "/api/me" && request.method === "GET") return json({ user: actor }, 200, origin);

      if (path === "/api/admins" && request.method === "GET") {
        const rows = await env.DB.prepare("SELECT id,username,name,role,active,created_at AS createdAt FROM admin_accounts ORDER BY role, name").all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/admins" && request.method === "POST") {
        if (!canManageAdmins(actor.role)) return json({ error: "المالك فقط يستطيع إدارة المدراء والمشرفين" }, 403, origin);
        const body = await request.json() as { username?: string; password?: string; name?: string; role?: Role };
        if (!body.username || !body.password || !body.name || !body.role || !["manager", "supervisor"].includes(body.role)) return json({ error: "بيانات الحساب غير مكتملة" }, 400, origin);
        const passwordHash = await hashPassword(body.password);
        try {
          await env.DB.prepare("INSERT INTO admin_accounts (id,username,password_hash,name,role,active,created_at) VALUES (?,?,?,?,?,?,?)").bind(id(), body.username.trim(), passwordHash, body.name.trim(), body.role, 1, now()).run();
        } catch { return json({ error: "اسم المستخدم مستخدم مسبقًا" }, 409, origin); }
        return json({ ok: true }, 201, origin);
      }
      if (path.startsWith("/api/admins/") && request.method === "PATCH") {
        if (!canManageAdmins(actor.role)) return json({ error: "المالك فقط يستطيع إدارة المدراء والمشرفين" }, 403, origin);
        const accountId = path.split("/").pop()!;
        const body = await request.json() as { name?: string; active?: boolean; password?: string };
        if (body.password) {
          await env.DB.prepare("UPDATE admin_accounts SET password_hash=? WHERE id=? AND role!='owner'").bind(await hashPassword(body.password), accountId).run();
        }
        if (body.name !== undefined || body.active !== undefined) {
          await env.DB.prepare("UPDATE admin_accounts SET name=COALESCE(?,name), active=COALESCE(?,active) WHERE id=? AND role!='owner'").bind(body.name ?? null, body.active === undefined ? null : (body.active ? 1 : 0), accountId).run();
        }
        return json({ ok: true }, 200, origin);
      }
      if (path.startsWith("/api/admins/") && request.method === "DELETE") {
        if (!canManageAdmins(actor.role)) return json({ error: "المالك فقط يستطيع إدارة المدراء والمشرفين" }, 403, origin);
        const accountId = path.split("/").pop()!;
        await env.DB.prepare("DELETE FROM admin_accounts WHERE id=? AND role!='owner'").bind(accountId).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/employees" && request.method === "GET") {
        const rows = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,device_id AS deviceId,device_label AS deviceLabel,created_at AS createdAt,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,work_start_time AS workStartTime,work_end_time AS workEndTime,grace_period_minutes AS gracePeriodMinutes,role,location_id AS locationId,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,specialties_json AS specialtiesJson FROM employees ORDER BY name").all();
        return json(rows.results.map((r:any)=>({...r, specialties: JSON.parse(r.specialtiesJson || "[]"), specialtiesJson: undefined})), 200, origin);
      }
      if (path === "/api/employees" && request.method === "POST") {
        if (!canWrite(actor.role)) return json({ error: "المشرف للعرض فقط" }, 403, origin);
        const b = await request.json() as any;
        if (!b.jobNumber || !b.name || !b.pinHash) return json({ error: "بيانات الموظف غير مكتملة" }, 400, origin);
        await env.DB.prepare("INSERT INTO employees (id,job_number,name,pin_hash,status,device_id,device_label,created_at,schedule_type,rotation_start_date,work_start_time,work_end_time,grace_period_minutes,role,location_id,rotation_days_on,rotation_days_off,specialties_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(id(), b.jobNumber, b.name, b.pinHash, b.status || "active", b.deviceId || null, b.deviceLabel || null, now(), b.scheduleType || "ADMIN", b.rotationStartDate || null, b.workStartTime || null, b.workEndTime || null, b.gracePeriodMinutes ?? 10, b.role || "staff", b.locationId || null, b.rotationDaysOn || null, b.rotationDaysOff || null, JSON.stringify(b.specialties || [])).run();
        return json({ ok: true }, 201, origin);
      }
      if (path.startsWith("/api/employees/") && ["PATCH","DELETE"].includes(request.method)) {
        if (!canWrite(actor.role)) return json({ error: "المشرف للعرض فقط" }, 403, origin);
        const employeeId = path.split("/").pop()!;
        if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM employees WHERE id=?").bind(employeeId).run(); return json({ ok: true }, 200, origin); }
        const b = await request.json() as any;
        await env.DB.prepare("UPDATE employees SET name=COALESCE(?,name), status=COALESCE(?,status), device_id=COALESCE(?,device_id), device_label=COALESCE(?,device_label), work_start_time=COALESCE(?,work_start_time), work_end_time=COALESCE(?,work_end_time), grace_period_minutes=COALESCE(?,grace_period_minutes), location_id=COALESCE(?,location_id), specialties_json=COALESCE(?,specialties_json) WHERE id=?")
          .bind(b.name ?? null,b.status ?? null,b.deviceId ?? null,b.deviceLabel ?? null,b.workStartTime ?? null,b.workEndTime ?? null,b.gracePeriodMinutes ?? null,b.locationId ?? null,b.specialties ? JSON.stringify(b.specialties) : null,employeeId).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === "/api/attendance" && request.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 500), 2000);
        const rows = await env.DB.prepare("SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ?").bind(limit).all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/attendance" && request.method === "POST") {
        if (!canWrite(actor.role)) return json({ error: "المشرف للعرض فقط" }, 403, origin);
        const b = await request.json() as any;
        await env.DB.prepare("INSERT INTO attendance (id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(id(),b.employeeId,b.jobNumber,b.employeeName,b.type,b.timestamp || now(),b.lat || 0,b.lng || 0,b.distanceMeters || 0,b.deviceId || "",request.headers.get("CF-Connecting-IP") || "unknown",b.qrCode || "",b.locationId || null).run();
        return json({ ok: true }, 201, origin);
      }

      if (path === "/api/audit" && request.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 500), 2000);
        const rows = await env.DB.prepare("SELECT * FROM audit ORDER BY timestamp DESC LIMIT ?").bind(limit).all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/requests" && request.method === "GET") {
        const rows = await env.DB.prepare("SELECT * FROM requests ORDER BY created_at DESC").all();
        return json(rows.results, 200, origin);
      }
      if (path === "/api/requests" && request.method === "POST") {
        const b = await request.json() as any;
        await env.DB.prepare("INSERT INTO requests (id,employee_id,employee_name,job_number,type,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(id(),b.employeeId,b.employeeName,b.jobNumber,b.type,b.reason || null,"pending",now()).run();
        return json({ ok: true }, 201, origin);
      }
      if (path.startsWith("/api/requests/") && request.method === "PATCH") {
        if (!canWrite(actor.role)) return json({ error: "المشرف للعرض فقط" }, 403, origin);
        const requestId = path.split("/").pop()!;
        const b = await request.json() as { status?: "approved"|"rejected" };
        if (!b.status) return json({ error: "الحالة مطلوبة" }, 400, origin);
        await env.DB.prepare("UPDATE requests SET status=? WHERE id=?").bind(b.status, requestId).run();
        return json({ ok: true }, 200, origin);
      }

      return json({ error: "المسار غير موجود" }, 404, origin);
    } catch (error) {
      console.error(error);
      return json({ error: "خطأ داخلي في الخادم" }, 500, origin);
    }
  },
};
