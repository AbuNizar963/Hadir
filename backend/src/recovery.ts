type Env = { DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string };

const original = (await import("./index")).default;
const encoder = new TextEncoder();

function b64(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$150000$${b64(salt)}$${b64(bits)}`;
}

function json(data: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type, authorization, x-device-id",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  }});
}

async function recovery(req: Request, env: Env, origin: string) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,OPTIONS" } });
  if (req.method !== "POST") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!env.OWNER_RECOVERY_CODE) return json({ error: "استعادة المالك غير مفعلة على الخادم" }, 503, origin);

  const input = await req.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(input.recoveryCode || "");
  const password = String(input.newPassword || "");
  if (!code || !password) return json({ error: "رمز الاستعادة وكلمة المرور الجديدة مطلوبان" }, 400, origin);
  if (password.length < 12) return json({ error: "كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل" }, 400, origin);
  if (code.length !== env.OWNER_RECOVERY_CODE.length) return json({ error: "رمز الاستعادة غير صحيح" }, 401, origin);

  let diff = 0;
  for (let i = 0; i < code.length; i++) diff |= code.charCodeAt(i) ^ env.OWNER_RECOVERY_CODE.charCodeAt(i);
  if (diff !== 0) return json({ error: "رمز الاستعادة غير صحيح" }, 401, origin);

  await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)").run();
  const used = await env.DB.prepare("SELECT value FROM settings WHERE key='owner_recovery_used'").first<{ value: string }>();
  if (used) return json({ error: "تم استخدام رمز استعادة المالك مسبقًا. أنشئ رمزًا جديدًا ثم احذف حالة الاستعادة من D1." }, 409, origin);

  const owner = await env.DB.prepare("SELECT id,username,name FROM admin_accounts WHERE role='owner' LIMIT 1").first<{ id: string; username: string; name: string }>();
  if (!owner) return json({ error: "لا يوجد حساب مالك في قاعدة البيانات" }, 404, origin);

  await env.DB.prepare("UPDATE admin_accounts SET password_hash=?,active=1 WHERE id=? AND role='owner'")
    .bind(await hashPassword(password), owner.id).run();
  await env.DB.prepare("INSERT INTO settings(key,value) VALUES('owner_recovery_used',?)")
    .bind(new Date().toISOString()).run();

  return json({ ok: true, username: owner.username, message: "تمت إعادة تعيين كلمة مرور المالك. استخدم اسم المستخدم نفسه لتسجيل الدخول." }, 200, origin);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    const origin = env.APP_ORIGIN || "*";
    if (url.pathname.replace(/\/$/, "") === "/api/auth/recover-owner") return recovery(req, env, origin);
    return original.fetch(req, env, ctx);
  },
};
