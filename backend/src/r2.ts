type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; username?: string; name: string; role: Role };
type Env = { DB: D1Database; PROFILE_IMAGES: R2Bucket };

const MAX_PROFILE_IMAGE_BYTES = 100 * 1024;
const IMAGE_CONTENT_TYPE = "image/webp";

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

function canAccess(actor: Actor, employeeId: string): boolean {
  if (actor.role === "owner" || actor.role === "manager") return true;
  if (actor.role === "supervisor" || actor.role === "staff") return actor.id === employeeId;
  return false;
}

function canWrite(actor: Actor, employeeId: string): boolean {
  if (actor.role === "owner" || actor.role === "manager") return true;
  return (actor.role === "supervisor" || actor.role === "staff") && actor.id === employeeId;
}

function keyFor(employeeId: string): string {
  return `employees/${encodeURIComponent(employeeId)}/avatar.webp`;
}

export async function handleProfileImageRequest(
  req: Request,
  env: Env,
  actor: Actor | null,
  origin: string,
): Promise<Response | null> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/api\/employees\/([^/]+)\/avatar$/);
  if (!match) return null;
  if (!env.PROFILE_IMAGES) return json({ error: "R2_PROFILE_IMAGES_NOT_CONFIGURED" }, 503, origin);
  if (!actor) return json({ error: "غير مصرح" }, 401, origin);

  const employeeId = decodeURIComponent(match[1]);
  if (!canAccess(actor, employeeId)) return json({ error: "غير مصرح" }, 403, origin);

  const key = keyFor(employeeId);

  if (req.method === "GET") {
    const row = await env.DB.prepare("SELECT avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<{ avatar: string | null }>();
    if (!row) return json({ error: "الموظف غير موجود" }, 404, origin);
    const storedKey = String(row.avatar || "");
    if (!storedKey) return json({ error: "صورة الموظف غير موجودة" }, 404, origin);
    const object = await env.PROFILE_IMAGES.get(storedKey);
    if (!object) return json({ error: "صورة الموظف غير موجودة في R2" }, 404, origin);
    const headers = new Headers({
      "content-type": IMAGE_CONTENT_TYPE,
      "cache-control": "private, max-age=300, must-revalidate",
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    });
    headers.set("etag", object.httpEtag);
    if (object.size !== undefined) headers.set("content-length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  }

  if (req.method === "POST") {
    if (!canWrite(actor, employeeId)) return json({ error: "لا تملك صلاحية تغيير هذه الصورة" }, 403, origin);
    const contentType = (req.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (contentType !== "multipart/form-data") return json({ error: "يجب إرسال الصورة بصيغة multipart/form-data" }, 415, origin);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return json({ error: "ملف الصورة مطلوب" }, 400, origin);
    if (file.type !== IMAGE_CONTENT_TYPE) return json({ error: "يجب أن تكون الصورة WebP" }, 415, origin);
    if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_BYTES) return json({ error: "حجم صورة الموظف يجب أن يكون أقل من 100 كيلوبايت" }, 413, origin);

    const employee = await env.DB.prepare("SELECT id,avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<{ id: string; avatar: string | null }>();
    if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);
    const previousKey = String(employee.avatar || "");

    await env.PROFILE_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: IMAGE_CONTENT_TYPE, cacheControl: "private, max-age=300, must-revalidate" },
      customMetadata: { employeeId, uploadedBy: actor.id, uploadedRole: actor.role },
    });

    try {
      await env.DB.prepare("UPDATE employees SET avatar=? WHERE id=?").bind(key, employeeId).run();
    } catch (error) {
      await env.PROFILE_IMAGES.delete(key).catch(() => undefined);
      throw error;
    }

    if (previousKey && previousKey !== key && previousKey.startsWith("employees/")) await env.PROFILE_IMAGES.delete(previousKey).catch(() => undefined);
    return json({ ok: true, key, size: file.size, contentType: IMAGE_CONTENT_TYPE }, 200, origin);
  }

  if (req.method === "DELETE") {
    if (!canWrite(actor, employeeId)) return json({ error: "لا تملك صلاحية حذف هذه الصورة" }, 403, origin);
    const row = await env.DB.prepare("SELECT avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<{ avatar: string | null }>();
    if (!row) return json({ error: "الموظف غير موجود" }, 404, origin);
    const storedKey = String(row.avatar || key);
    await env.PROFILE_IMAGES.delete(storedKey).catch(() => undefined);
    await env.DB.prepare("UPDATE employees SET avatar=NULL WHERE id=?").bind(employeeId).run();
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "الطريقة غير مدعومة" }, 405, origin);
}
