type Env = { DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string };
const original = (await import("./recovery")).default;
const uid = () => crypto.randomUUID();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" } });

async function actorFromOriginal(req: Request, env: Env) {
  const url = new URL(req.url); url.pathname = "/api/me"; url.search = "";
  const probe = await original.fetch(new Request(url, { method: "GET", headers: req.headers }), env, {} as ExecutionContext);
  if (!probe.ok) return null;
  return (await probe.json().catch(() => ({})) as any).user || null;
}

async function ensureWorkflowSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'info',read_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC)"),
  ]);
}

async function notify(db: D1Database, userId: string, title: string, message: string, type = "info") {
  await db.prepare("INSERT INTO notifications(id,user_id,title,message,type,created_at) VALUES(?,?,?,?,?,?)").bind(uid(), userId, title, message, type, new Date().toISOString()).run();
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const origin = env.APP_ORIGIN || "*";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" } });
    await ensureWorkflowSchema(env.DB);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const actor = await actorFromOriginal(req, env);

    if (path === "/api/notifications" && req.method === "GET") {
      if (!actor) return json({ error: "غير مصرح" }, 401, origin);
      const rows = await env.DB.prepare("SELECT id,user_id AS userId,title,message,type,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all();
      return json(rows.results || [], 200, origin);
    }
    if (path === "/api/notifications/read" && req.method === "POST") {
      if (!actor) return json({ error: "غير مصرح" }, 401, origin);
      const b = await req.json().catch(() => ({})) as any;
      if (b.id) await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(new Date().toISOString(), String(b.id), actor.id).run();
      else await env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(new Date().toISOString(), actor.id).run();
      return json({ ok: true }, 200, origin);
    }

    const requestMatch = path.match(/^\/api\/requests\/([^/]+)$/);
    const confirmMatch = path.match(/^\/api\/requests\/([^/]+)\/confirm$/);
    if (path === "/api/requests" && req.method === "GET") {
      if (!actor || !["owner","manager","supervisor","staff"].includes(actor.role)) return json({ error: "غير مصرح" }, 401, origin);
      const rows = actor.role === "staff"
        ? await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all()
        : await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests ORDER BY created_at DESC LIMIT 500").all();
      return json(rows.results || [], 200, origin);
    }
    if (path === "/api/requests" && req.method === "POST") {
      if (!actor || actor.role !== "staff") return json({ error: "الموظف فقط يستطيع إنشاء الطلب" }, 403, origin);
      const b = await req.json().catch(() => ({})) as any;
      const type = String(b.type || b.requestType || "");
      if (!["permission","leave","checkout"].includes(type)) return json({ error: "نوع الطلب غير صحيح" }, 400, origin);
      const employee = await env.DB.prepare("SELECT job_number AS jobNumber,name FROM employees WHERE id=? AND status='active' LIMIT 1").bind(actor.id).first<any>();
      if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);
      const id = uid();
      await env.DB.prepare("INSERT INTO requests(id,employee_id,employee_name,job_number,type,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id, actor.id, employee.name, employee.jobNumber, type, String(b.reason || ""), "pending", new Date().toISOString()).run();
      const admins = await env.DB.prepare("SELECT id FROM admin_accounts WHERE active=1 AND role IN ('owner','manager')").all<any>();
      for (const a of admins.results || []) await notify(env.DB, a.id, "طلب موظف جديد", `${employee.name} أرسل طلب ${type === "permission" ? "استئذان" : type === "leave" ? "إجازة" : "انصراف"}.`, "info");
      return json({ ok: true, id, status: "pending" }, 201, origin);
    }
    if (requestMatch && req.method === "PATCH") {
      if (!actor || !["owner","manager"].includes(actor.role)) return json({ error: "غير مصرح" }, 403, origin);
      const id = requestMatch[1]; const b = await req.json().catch(() => ({})) as any; const status = String(b.status || "");
      if (!["approved","rejected"].includes(status)) return json({ error: "حالة غير صحيحة" }, 400, origin);
      const r = await env.DB.prepare("SELECT employee_id AS employeeId FROM requests WHERE id=? AND status='pending' LIMIT 1").bind(id).first<any>();
      if (!r) return json({ error: "الطلب غير موجود أو تمت مراجعته" }, 409, origin);
      await env.DB.prepare("UPDATE requests SET status=? WHERE id=? AND status='pending'").bind(status, id).run();
      await notify(env.DB, r.employeeId, status === "approved" ? "تمت الموافقة" : "تم رفض الطلب", status === "approved" ? "تمت الموافقة من قبل المدير أو المالك، يمكنك الآن تأكيد العملية." : "تم رفض طلبك من قبل المدير أو المالك.", status === "approved" ? "success" : "warning");
      return json({ ok: true, status }, 200, origin);
    }
    if (confirmMatch && req.method === "POST") {
      if (!actor || actor.role !== "staff") return json({ error: "غير مصرح" }, 403, origin);
      const id = confirmMatch[1];
      const result = await env.DB.prepare("UPDATE requests SET status='confirmed' WHERE id=? AND employee_id=? AND status='approved'").bind(id, actor.id).run();
      if (!result.meta.changes) return json({ error: "لا يمكن التأكيد قبل موافقة المدير" }, 403, origin);
      return json({ ok: true, status: "confirmed" }, 200, origin);
    }

    return original.fetch(req, env, ctx);
  }
};
