import { sendUserPush } from "./push";

type Env = { DB: D1Database; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };
type Actor = { id: string; role: string; name?: string };

type RequestRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string;
  type: "permission" | "leave" | "checkout";
  reason: string;
  status: "pending" | "approved" | "rejected" | "confirmed" | "cancelled";
  createdAt: string;
  startDate?: string | null;
  endDate?: string | null;
};

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "cache-control": "no-store",
  },
});

const requestType = (value: unknown): RequestRow["type"] | null => {
  const type = String(value || "");
  return type === "permission" || type === "leave" || type === "checkout" ? type : null;
};

const dateValue = (value: unknown) => {
  const v = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

const typeLabel = (type: RequestRow["type"]) =>
  type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : "انصراف";

async function ensureRequestSchema(db: D1Database) {
  await db.batch([
    db.prepare("ALTER TABLE requests ADD COLUMN start_date TEXT"),
    db.prepare("ALTER TABLE requests ADD COLUMN end_date TEXT"),
  ]).catch(() => undefined);
}

async function notify(env: Env, recipientId: string, title: string, body: string, type: "info" | "success" | "warning", url = "/manager/requests") {
  const id = String(recipientId || "").trim();
  if (!id) throw new Error("NOTIFICATION_RECIPIENT_REQUIRED");
  const createdAt = now();
  await env.DB.prepare(
    "INSERT INTO notifications(id,recipient_id,title,body,severity,type,created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(uid(), id, title, body, type, type, createdAt).run();

  const subscriptions = await env.DB.prepare(
    "SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?"
  ).bind(id).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
  for (const subscription of subscriptions.results || []) {
    try {
      const result = await sendUserPush(
        env,
        { endpoint: String(subscription.endpoint), keys: { p256dh: String(subscription.p256dh), auth: String(subscription.auth) } },
        { title, body, url, type, tag: `hadir-request-${type}` },
      );
      if (result.status === 404 || result.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(subscription.id).run().catch(() => undefined);
      }
    } catch {
      // D1 notification is authoritative.
    }
  }
}

export async function handleRequests(req: Request, env: Env, actor: Actor | null, origin: string) {
  await ensureRequestSchema(env.DB);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method;
  const requestMatch = path.match(/^\/api\/requests\/([^/]+)$/);
  const confirmMatch = path.match(/^\/api\/requests\/([^/]+)\/confirm$/);

  if (path === "/api/requests" && method === "GET") {
    if (!actor || !["owner", "manager", "supervisor", "staff"].includes(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
    const rows = actor.role === "staff"
      ? await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt,start_date AS startDate,end_date AS endDate FROM requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all<RequestRow>()
      : await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt,start_date AS startDate,end_date AS endDate FROM requests ORDER BY created_at DESC LIMIT 500").all<RequestRow>();
    return json(rows.results || [], 200, origin);
  }

  if (path === "/api/requests" && method === "POST") {
    if (!actor || !["owner", "manager"].includes(actor.role) && actor.role !== "staff") return json({ error: "غير مصرح" }, 403, origin);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const type = requestType(body.type ?? body.requestType);
    if (!type) return json({ error: "نوع الطلب غير صحيح" }, 400, origin);
    const startDate = dateValue(body.startDate);
    const endDate = dateValue(body.endDate);
    if (!startDate || !endDate) return json({ error: "يجب تحديد تاريخ البداية وتاريخ النهاية" }, 400, origin);
    if (endDate < startDate) return json({ error: "تاريخ النهاية يجب أن يكون بعد أو مساويًا لتاريخ البداية" }, 400, origin);

    const requestedEmployeeId = String(body.employeeId || "").trim();
    const employeeId = actor.role === "staff" ? actor.id : requestedEmployeeId;
    if (!employeeId) return json({ error: "الموظف مطلوب" }, 400, origin);
    const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? AND status='active' LIMIT 1").bind(employeeId).first<{ id: string; jobNumber: string; name: string }>();
    if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);

    const requestId = uid();
    const createdAt = now();
    const reason = String(body.reason || "").trim();
    const createdByManager = actor.role !== "staff";
    const initialStatus = createdByManager ? "approved" : "pending";
    await env.DB.prepare(
      "INSERT INTO requests(id,employee_id,employee_name,job_number,type,reason,status,created_at,start_date,end_date) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).bind(requestId, employee.id, employee.name, employee.jobNumber, type, reason, initialStatus, createdAt, startDate, endDate).run();

    if (createdByManager) {
      try {
        await notify(env, employee.id, type === "leave" ? "تم تسجيل إجازة" : "تم تسجيل استئذان", `${typeLabel(type)} من ${startDate} إلى ${endDate}.`, "success", "/employee/notifications");
      } catch {
        // The request remains authoritative in D1 even if push delivery fails.
      }
      return json({ ok: true, id: requestId, status: initialStatus, startDate, endDate }, 201, origin);
    }

    const admins = await env.DB.prepare(
      "SELECT id FROM admin_accounts WHERE active=1 AND role IN ('owner','manager') ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END"
    ).all<{ id: string }>();
    const recipients = (admins.results || []).map(row => String(row.id || "").trim()).filter(Boolean);
    if (!recipients.length) return json({ ok: true, id: requestId, status: "pending", notification: "queued", startDate, endDate }, 201, origin);

    try {
      for (const recipientId of recipients) {
        await notify(env, recipientId, "طلب موظف جديد", `${employee.name} أرسل طلب ${typeLabel(type)} من ${startDate} إلى ${endDate}.`, "info", `/manager/requests`);
      }
    } catch (error) {
      return json({ ok: true, id: requestId, status: "pending", notification: "pending", detail: error instanceof Error ? error.message : String(error), startDate, endDate }, 201, origin);
    }

    return json({ ok: true, id: requestId, status: "pending", startDate, endDate }, 201, origin);
  }

  if (requestMatch && method === "PATCH") {
    if (!actor || !["owner", "manager"].includes(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const status = String(body.status || "");
    if (status !== "approved" && status !== "rejected") return json({ error: "حالة غير صحيحة" }, 400, origin);
    const row = await env.DB.prepare("SELECT employee_id AS employeeId FROM requests WHERE id=? AND status='pending' LIMIT 1").bind(requestMatch[1]).first<{ employeeId: string }>();
    if (!row?.employeeId) return json({ error: "الطلب غير موجود أو تمت مراجعته" }, 409, origin);
    await env.DB.prepare("UPDATE requests SET status=? WHERE id=? AND status='pending'").bind(status, requestMatch[1]).run();
    try {
      await notify(
        env,
        row.employeeId,
        status === "approved" ? "تمت الموافقة على طلبك" : "تم رفض طلبك",
        status === "approved" ? "تمت الموافقة على طلبك من قبل الإدارة." : "تم رفض طلبك من قبل الإدارة.",
        status === "approved" ? "success" : "warning",
        "/employee/notifications",
      );
    } catch (error) {
      await env.DB.prepare("UPDATE requests SET status='pending' WHERE id=? AND status=?").bind(requestMatch[1], status).run().catch(() => undefined);
      return json({ error: "تمت إعادة الطلب إلى قيد المراجعة لأن إشعار الموظف لم يُنشأ", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
    }
    return json({ ok: true, status }, 200, origin);
  }

  if (confirmMatch && method === "POST") {
    if (!actor || actor.role !== "staff") return json({ error: "غير مصرح" }, 403, origin);
    const result = await env.DB.prepare("UPDATE requests SET status='confirmed' WHERE id=? AND employee_id=? AND status='approved'").bind(confirmMatch[1], actor.id).run();
    if (!result.meta.changes) return json({ error: "لا يمكن التأكيد قبل موافقة المدير" }, 403, origin);
    return json({ ok: true, status: "confirmed" }, 200, origin);
  }

  return null;
}
