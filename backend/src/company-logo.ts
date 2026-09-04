type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; role: Role };
type Env = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };

const MAX_LOGO_BYTES = 100 * 1024;
const LOGO_CONTENT_TYPE = "image/webp";
const LOGO_KEY_SETTING = "brandLogoR2Key";
const LOGO_URL_SETTING = "brandLogo";
const LOGO_BACKUP_SETTING = "brandLogoDataUrl";
const SESSION_COOKIE = "hadir_session";

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, x-device-id",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "cache-control": "no-store",
    },
  });
}

function canManage(actor: Actor | null): boolean {
  return actor?.role === "owner" || actor?.role === "manager";
}

function logoUrl(request: Request, version?: string): string {
  const url = new URL(request.url);
  url.pathname = "/api/company/logo";
  url.search = version ? `?v=${encodeURIComponent(version)}` : "";
  return url.toString();
}

function requestToken(req: Request): string {
  const cookie = req.headers.get("cookie") || "";
  const item = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`));
  if (item) return decodeURIComponent(item.slice(SESSION_COOKIE.length + 1));
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function authenticatedActor(req: Request, env: Env): Promise<Actor | null> {
  const raw = requestToken(req);
  if (!raw) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    const tokenHash = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const session = await env.DB.prepare("SELECT user_id AS userId,user_type AS userType FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(tokenHash).first<{ userId: string; userType: string }>();
    if (!session || session.userType !== "admin") return null;
    const row = await env.DB.prepare("SELECT id,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(session.userId).first<{ id: string; role: Role; active: number }>();
    return row ? { id: String(row.id), role: row.role } : null;
  } catch {
    return null;
  }
}

function dataUrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return `data:${LOGO_CONTENT_TYPE};base64,${btoa(binary)}`;
}

async function readStoredLogoBackup(env: Env): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_BACKUP_SETTING).first<{ value: string }>();
  const value = String(row?.value || "").trim();
  return value.startsWith(`data:${LOGO_CONTENT_TYPE};base64,`) && value.length <= 140000 ? value : null;
}

export async function handleCompanyLogoRequest(
  req: Request,
  env: Env,
  actor: Actor | null,
  origin: string,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname.replace(/\/$/, "") !== "/api/company/logo") return null;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" } });
  if (!env.PROFILE_IMAGES) return json({ error: "R2 binding PROFILE_IMAGES غير موجود" }, 503, origin);

  if (req.method === "GET") {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();
    const key = String(row?.value || "").trim();
    if (!key) return new Response(null, { status: 404, headers: { "access-control-allow-origin": origin, "cache-control": "no-store" } });
    const object = await env.PROFILE_IMAGES.get(key);
    if (!object) return new Response(null, { status: 404, headers: { "access-control-allow-origin": origin, "cache-control": "no-store" } });
    const headers = new Headers({ "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "cache-control": "no-store" });
    object.writeHttpMetadata(headers);
    headers.set("content-type", LOGO_CONTENT_TYPE);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { status: 200, headers });
  }

  const resolvedActor = actor || await authenticatedActor(req, env);
  if (!canManage(resolvedActor)) return json({ error: "غير مصرح" }, 403, origin);

  if (req.method === "POST") {
    const contentType = (req.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (contentType !== "multipart/form-data") return json({ error: "يجب إرسال الشعار بصيغة multipart/form-data" }, 415, origin);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return json({ error: "ملف الشعار مطلوب" }, 400, origin);
    if (file.type !== LOGO_CONTENT_TYPE) return json({ error: "يجب أن يكون الشعار بصيغة WebP" }, 415, origin);
    if (file.size <= 0 || file.size > MAX_LOGO_BYTES) return json({ error: "حجم الشعار يجب أن يكون أقل من 100 كيلوبايت" }, 413, origin);

    const key = `company/logo-${crypto.randomUUID()}.webp`;
    const publicUrl = logoUrl(req, key);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const backupDataUrl = dataUrlFromBytes(bytes);
    if (backupDataUrl.length > 140000) return json({ error: "حجم الشعار بعد التجهيز أكبر من الحد المسموح" }, 413, origin);

    await env.PROFILE_IMAGES.put(key, bytes, {
      httpMetadata: { contentType: LOGO_CONTENT_TYPE, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { purpose: "company-logo", uploadedBy: resolvedActor?.id || "unknown" },
    });

    const storedObject = await env.PROFILE_IMAGES.head(key);
    if (!storedObject) {
      await env.PROFILE_IMAGES.delete(key).catch(() => undefined);
      console.error("company logo R2 persistence verification failed", key);
      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);
    }

    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(LOGO_KEY_SETTING, key),
        env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(LOGO_URL_SETTING, publicUrl),
        env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(LOGO_BACKUP_SETTING, backupDataUrl),
      ]);
    } catch (error) {
      // Never delete a successfully persisted logo from R2 because a D1 write
      // failed. This is especially important when the D1 free-tier write limit
      // is exhausted: the original file must remain available in R2 so it can
      // be linked by the next successful settings save.
      console.error("company logo settings update failed; preserving R2 object", key, error);
      return json({ error: "تم رفع الشعار إلى R2 لكن تعذر تحديث إعدادات D1. لم يتم حذف ملف الشعار من R2." }, 503, origin);
    }

    return json({ ok: true, url: publicUrl, key, size: file.size, contentType: LOGO_CONTENT_TYPE }, 200, origin);
  }

  if (req.method === "DELETE") {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();
    const key = String(row?.value || "").trim();
    if (key) await env.PROFILE_IMAGES.delete(key).catch(() => undefined);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_KEY_SETTING),
      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_URL_SETTING),
      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_BACKUP_SETTING),
    ]);
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "الطريقة غير مدعومة" }, 405, origin);
}
