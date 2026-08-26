type Env = { DB: D1Database };
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
};

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "cache-control": "no-store" },
});
const requestType = (value: unknown): RequestRow["type"] | null => {
  const type = String(value || "");
  return type === "permission" || type === "leave" || type === "checkout" ? type : null;
};
const typeLabel = (type: RequestRow["type"]) => type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : "انصراف";

async function notify(env: Env, recipientId: string, title: string, body: string, type: "info" | "success" | "warning", relatedId?: string) {
  const id = String(recipientId || "").trim();
  if (!id) throw new Error("NOTIFICATION_RECIPIENT_REQUIRED");
  // Notifications are durable records. Online/push delivery is deliberately not a prerequisite.
  await env.DB.prepare(
    "INSERT INTO notifications(id,recipient_id,title,body,severity,type,related_id,created_at) VALUES(?,?,?,?,?,?,?,?)"
  ).bind(uid(), id, title, body, type, type, relatedId || null, now()).run();
}

export async function handleRequests(req: Request, env: Env, actor: Actor | null, origin: string) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method;
  const requestMatch = path.match(/^\/api\/requests\/([^/]+)$/);
  const confirmMatch = path.match(/^\/api\/requests\/([^/]+)\/confirm$/);

  if (path === "/api/requests" && method === "GET") {
    if (!actor || !["owner", "manager", "supervisor", "staff"].includes(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
    const rows = actor.role === "staff"
      ? await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all<RequestRow>()
      : await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests ORDER BY created_at DESC LIMIT 500").all<RequestRow>();
    return json(rows.results || [], 200, origin);
  }

  if (path === "/api/requests" && method === "POST") {
    if (!actor || actor.role !== "staff") return json({ error: "الموظف فقط يستطيع إنشاء الطلب" }, 403, origin);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const type = requestType(body.type ?? body.requestType);
    if (!type) return json({ error: "نوع الطلب غير صحيح" }, 400, origin);
    const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? AND status='active' LIMIT 1").bind(actor.id).first<{ id: string; jobNumber: string; name: string }>();
    if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);

    // The request itself is durable and must never depend on an admin being online.
    const requestId = uid();
    const createdAt = now();
    const reason = String(body.reason || "").trim();
    await env.DB.prepare(
      "INSERT INTO requests(id,employee_id,employee_name,job_number,type,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)"
    ).bind(requestId, employee.id, employee.name, employee.jobNumber, type, reason, "pending", createdAt).run();

    // `active=1` means an enabled administrative account, not an online session.
    // If no admin account exists, keep the request pending rather than deleting it.
    const admins = await env.DB.prepare(
      "SELECT id FROM admin_accounts WHERE active=1 AND role IN ('owner','manager') ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END"
    ).all<{ id: string }>();
    const recipients = (admins.results || []).map(row => String(row.id || "").trim()).filter(Boolean);

    // Persist notifications for every eligible recipient. No WebSocket, push connection,
    // or current online state is required. An admin will see these records after login.
    if (recipients.length) {
      try {
        for (const recipientId of recipients) {
          await notify(env, recipientId, "طلب موظف جديد", `${employee.name} أرسل طلب ${typeLabel(type)}.`, "info", requestId);
        }
      } catch (error) {
        // The request remains visible in the admin requests board even if notification delivery fails.
        // This is intentionally not rolled back: the request is the source-of-truth record.
        return json({ ok: true, id: requestId, status: "pending", notificationPending: true }, 201, origin);
      }
    }

    return json({ ok: true, id: requestId, status: "pending", notificationPending: recipients.length === 0 }, 201, origin);
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
      await notify(env, row.employeeId, status === "approved" ? "تمت الموافقة على طلبك" : "تم رفض طلبك", status === "approved" ? "تمت الموافقة على طلبك من قبل الإدارة." : "تم رفض طلبك من قبل الإدارة.", status === "approved" ? "success" : "warning", requestMatch[1]);
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
