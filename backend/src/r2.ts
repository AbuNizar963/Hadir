type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; username: string; name: string; role: Role };
type Env = { DB: D1Database; PROFILE_IMAGES: R2Bucket };

const MAX_PROFILE_IMAGE_BYTES = 100 * 1024;
const IMAGE_CONTENT_TYPE = "image/webp";

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, authorization, x-device-id",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    },
  });
}

function canAccess(actor: Actor, employeeId: string): boolean {
  return actor.role === "owner" || actor.role === "manager" || actor.id === employeeId;
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

  if (!actor) return json({ error: "غير مصرح" }, 401, origin);

  const employeeId = decodeURIComponent(match[1]);
  if (!canAccess(actor, employeeId)) return json({ error: "غير مصرح" }, 403, origin);

  const key = keyFor(employeeId);

  if (req.method === "GET") {
    const object = await env.PROFILE_IMAGES.get(key);
    if (!object) return json({ error: "صورة الموظف غير موجودة" }, 404, origin);

    const headers = new Headers();
    headers.set("content-type", IMAGE_CONTENT_TYPE);
    headers.set("cache-control", "private, max-age=300, must-revalidate");
    headers.set("etag", object.httpEtag);
    if (object.size !== undefined) headers.set("content-length", String(object.size));

    return new Response(object.body, { status: 200, headers });
  }

  if (req.method === "POST") {
    if (actor.role !== "owner" && actor.role !== "manager") {
      return json({ error: "المالك أو المدير فقط يستطيعان تغيير صورة الموظف" }, 403, origin);
    }

    const contentType = (req.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (contentType !== "multipart/form-data") {
      return json({ error: "يجب إرسال الصورة بصيغة multipart/form-data" }, 415, origin);
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return json({ error: "ملف الصورة مطلوب" }, 400, origin);
    if (file.type !== IMAGE_CONTENT_TYPE) return json({ error: "يجب أن تكون الصورة WebP" }, 415, origin);
    if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
      return json({ error: "حجم صورة الموظف يجب أن يكون أقل من 100 كيلوبايت" }, 413, origin);
    }

    const employee = await env.DB.prepare("SELECT id FROM employees WHERE id=? LIMIT 1")
      .bind(employeeId)
      .first<{ id: string }>();
    if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);

    const previous = await env.DB.prepare("SELECT avatar FROM employees WHERE id=? LIMIT 1")
      .bind(employeeId)
      .first<{ avatar: string | null }>();

    await env.PROFILE_IMAGES.put(key, file.stream(), {
      httpMetadata: {
        contentType: IMAGE_CONTENT_TYPE,
        cacheControl: "private, max-age=300, must-revalidate",
      },
      customMetadata: {
        employeeId,
        uploadedBy: actor.id,
      },
    });

    try {
      await env.DB.prepare("UPDATE employees SET avatar=? WHERE id=?")
        .bind(key, employeeId)
        .run();
    } catch (error) {
      await env.PROFILE_IMAGES.delete(key).catch(() => undefined);
      throw error;
    }

    if (previous?.avatar && previous.avatar !== key && previous.avatar.startsWith("employees/")) {
      await env.PROFILE_IMAGES.delete(previous.avatar).catch(() => undefined);
    }

    return json({ ok: true, key, size: file.size }, 200, origin);
  }

  if (req.method === "DELETE") {
    if (actor.role !== "owner" && actor.role !== "manager") {
      return json({ error: "المالك أو المدير فقط يستطيعان حذف صورة الموظف" }, 403, origin);
    }

    await env.PROFILE_IMAGES.delete(key);
    await env.DB.prepare("UPDATE employees SET avatar=NULL WHERE id=?").bind(employeeId).run();
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "الطريقة غير مدعومة" }, 405, origin);
}
