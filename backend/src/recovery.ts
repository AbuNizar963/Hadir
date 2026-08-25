type Env = { DB: D1Database; PROFILE_IMAGES: R2Bucket; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string };

const original = (await import("./index")).default;
const { handleProfileImageRequest } = await import("./r2");
const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100000;

function b64(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

function json(data: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type, authorization, x-device-id",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  }});
}

async function ensureRecoveryTables(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS admin_accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius_meters REAL NOT NULL)"),
  ]);
}

async function syncMainLocation(db: D1Database, settings: Record<string, unknown>) {
  const lat = Number(settings.workSiteLat);
  const lng = Number(settings.workSiteLng);
  const radiusMeters = Number(settings.radiusMeters);
  if (![lat, lng, radiusMeters].every(Number.isFinite) || radiusMeters < 0) return false;
  await db.prepare("INSERT INTO locations(id,name,lat,lng,radius_meters) VALUES('main',?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lng=excluded.lng,radius_meters=excluded.radius_meters")
    .bind(lat, lng, radiusMeters).run();
  return true;
}

async function recoverLocationFromSettings(db: D1Database) {
  const rows = await db.prepare("SELECT key,value FROM settings WHERE key IN ('workSiteLat','workSiteLng','radiusMeters')").all<{key:string,value:string}>();
  const settings: Record<string, unknown> = {};
  for (const row of rows.results) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }
  const synced = await syncMainLocation(db, settings);
  if (!synced) return null;
  return await db.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations WHERE id='main' LIMIT 1").first<any>();
}

async function actorFromOriginal(req: Request, env: Env) {
  const url = new URL(req.url);
  url.pathname = "/api/me";
  url.search = "";
  const probe = await original.fetch(new Request(url, { method: "GET", headers: req.headers }), env, {} as ExecutionContext);
  if (!probe.ok) return null;
  return (await probe.json().catch(() => ({})) as any).user || null;
}

async function recovery(req: Request, env: Env, origin: string) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" } });
  if (req.method !== "POST") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!env.OWNER_RECOVERY_CODE) return json({ error: "استعادة المالك غير مفعلة على الخادم" }, 503, origin);

  const input = await req.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(input.recoveryCode || "");
  const password = String(input.newPassword || "");
  const name = String(input.ownerName || "").trim();
  const username = String(input.ownerUsername || "").trim();
  if (!code || !password) return json({ error: "رمز الاستعادة وكلمة المرور الجديدة مطلوبان" }, 400, origin);
  if (password.length < 12) return json({ error: "كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل" }, 400, origin);
  if (code.length !== env.OWNER_RECOVERY_CODE.length) return json({ error: "رمز الاستعادة غير صحيح" }, 401, origin);

  let diff = 0;
  for (let i = 0; i < code.length; i++) diff |= code.charCodeAt(i) ^ env.OWNER_RECOVERY_CODE.charCodeAt(i);
  if (diff !== 0) return json({ error: "رمز الاستعادة غير صحيح" }, 401, origin);

  try {
    await ensureRecoveryTables(env.DB);
    const used = await env.DB.prepare("SELECT value FROM settings WHERE key='owner_recovery_used'").first<{ value: string }>();
    if (used) return json({ error: "تم استخدام رمز استعادة المالك مسبقًا. أنشئ رمزًا جديدًا ثم أعد المحاولة." }, 409, origin);

    const owner = await env.DB.prepare("SELECT id,username,name FROM admin_accounts WHERE role='owner' LIMIT 1").first<{ id: string; username: string; name: string }>();
    const passwordHash = await hashPassword(password);
    const timestamp = new Date().toISOString();

    if (owner) {
      await env.DB.prepare("UPDATE admin_accounts SET password_hash=?,active=1 WHERE id=? AND role='owner'").bind(passwordHash, owner.id).run();
      const updated = await env.DB.prepare("SELECT id FROM admin_accounts WHERE id=? AND role='owner' AND active=1 LIMIT 1").bind(owner.id).first();
      if (!updated) throw new Error("لم يتم تحديث حساب المالك");
      await env.DB.prepare("INSERT INTO settings(key,value) VALUES('owner_recovery_used',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(timestamp).run();
      return json({ ok: true, username: owner.username, message: "تمت إعادة تعيين كلمة مرور المالك. استخدم اسم المستخدم نفسه لتسجيل الدخول." }, 200, origin);
    }

    if (!name || !username) return json({ error: "لم يتم العثور على حساب مالك. أدخل اسم المالك واسم المستخدم لإنشاء حساب المالك الأول." }, 400, origin);
    if (username.length < 3 || username.length > 64) return json({ error: "اسم المستخدم يجب أن يكون بين 3 و64 حرفًا" }, 400, origin);
    if (!/^[A-Za-z0-9_.@-]+$/.test(username)) return json({ error: "اسم المستخدم يحتوي على أحرف غير مدعومة" }, 400, origin);

    const existing = await env.DB.prepare("SELECT id,role FROM admin_accounts WHERE username=? LIMIT 1").bind(username).first<{ id: string; role: string }>();
    if (existing) {
      if (existing.role === "owner") {
        await env.DB.prepare("UPDATE admin_accounts SET password_hash=?,name=?,active=1 WHERE id=?").bind(passwordHash, name, existing.id).run();
      } else {
        await env.DB.prepare("UPDATE admin_accounts SET password_hash=?,name=?,role='owner',active=1 WHERE id=?").bind(passwordHash, name, existing.id).run();
      }
    } else {
      await env.DB.prepare("INSERT INTO admin_accounts(id,username,password_hash,name,role,active,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), username, passwordHash, name, "owner", 1, timestamp).run();
    }

    const created = await env.DB.prepare("SELECT id,username,name FROM admin_accounts WHERE username=? AND role='owner' AND active=1 LIMIT 1").bind(username).first();
    if (!created) throw new Error("تم تنفيذ عملية قاعدة البيانات لكن لم يظهر حساب المالك عند التحقق");
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('owner_recovery_used',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(timestamp).run();
    return json({ ok: true, username, message: "تم إنشاء حساب المالك الأول بنجاح. يمكنك تسجيل الدخول الآن." }, existing ? 200 : 201, origin);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: "تعذر إنشاء/إعادة تعيين حساب المالك في قاعدة البيانات", detail }, 500, origin);
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    const origin = env.APP_ORIGIN || "*";
    if (url.pathname.replace(/\/$/, "") === "/api/auth/recover-owner") return recovery(req, env, origin);

    if (url.pathname.replace(/\/$/, "").match(/^\/api\/employees\/[^/]+\/avatar$/)) {
      const actor = await actorFromOriginal(req, env);
      return handleProfileImageRequest(req, env, actor, origin);
    }

    if (url.pathname.replace(/\/$/, "") === "/api/settings" && req.method === "PUT") {
      const copy = req.clone();
      const response = await original.fetch(req, env, ctx);
      if (response.ok) {
        try {
          const settings = await copy.json() as Record<string, unknown>;
          await ensureRecoveryTables(env.DB);
          await syncMainLocation(env.DB, settings);
        } catch (error) {
          console.error("تعذر مزامنة موقع المقر الرئيسي مع D1:", error);
        }
      }
      return response;
    }

    if (url.pathname.replace(/\/$/, "") === "/api/employee-location" && req.method === "GET") {
      const response = await original.fetch(req, env, ctx);
      if (response.status !== 404) return response;
      try {
        await ensureRecoveryTables(env.DB);
        const location = await recoverLocationFromSettings(env.DB);
        if (location) return json({ location }, 200, origin);
      } catch (error) {
        console.error("تعذر استرجاع موقع الموظف من D1:", error);
      }
      return response;
    }

    return original.fetch(req, env, ctx);
  },
};
