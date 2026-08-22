type WorkforceEnv = { DB: D1Database };

type Actor = { id: string; role: "owner" | "manager" | "supervisor" | "staff"; name?: string };

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function ensureWorkforceSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'info',read_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS violations(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,type TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'warning',occurred_at TEXT NOT NULL,minutes INTEGER NOT NULL DEFAULT 0,reason TEXT,status TEXT NOT NULL DEFAULT 'open',reviewed_by TEXT,reviewed_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_violations_employee ON violations(employee_id,occurred_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status,occurred_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS anomaly_events(id TEXT PRIMARY KEY,employee_id TEXT,type TEXT NOT NULL,score REAL NOT NULL DEFAULT 0,evidence TEXT,status TEXT NOT NULL DEFAULT 'new',detected_at TEXT NOT NULL,resolved_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_events(status,detected_at DESC)"),
  ]);
}

function canManage(actor: Actor | null) { return !!actor && ["owner", "manager", "supervisor"].includes(actor.role); }

export async function handleWorkforce(req: Request, env: WorkforceEnv, actor: Actor | null, pathname: string) {
  if (!actor) return json({ error: "غير مصرح" }, 401);
  await ensureWorkforceSchema(env.DB);

  if (pathname === "/api/notifications" && req.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,user_id AS userId,title,message,type,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all();
    return json(rows.results || []);
  }
  if (pathname === "/api/notifications/read" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as any;
    if (body.id) await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(now(), String(body.id), actor.id).run();
    else await env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(now(), actor.id).run();
    return json({ ok: true });
  }
  if (pathname === "/api/violations" && req.method === "GET") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") || 500), 1), 2000);
    const rows = await env.DB.prepare("SELECT id,employee_id AS employeeId,type,severity,occurred_at AS occurredAt,minutes,reason,status,reviewed_by AS reviewedBy,reviewed_at AS reviewedAt,created_at AS createdAt FROM violations ORDER BY occurred_at DESC LIMIT ?").bind(limit).all();
    return json(rows.results || []);
  }
  if (pathname === "/api/violations" && req.method === "POST") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const body = await req.json().catch(() => ({})) as any;
    const employeeId = String(body.employeeId || "").trim();
    const type = String(body.type || "other").trim();
    if (!employeeId || !type) return json({ error: "بيانات المخالفة غير مكتملة" }, 400);
    const employee = await env.DB.prepare("SELECT id FROM employees WHERE id=? LIMIT 1").bind(employeeId).first();
    if (!employee) return json({ error: "EMPLOYEE_NOT_FOUND" }, 404);
    const record = { id: id(), employeeId, type, severity: String(body.severity || "warning"), occurredAt: String(body.occurredAt || now()), minutes: Math.max(0, Math.round(Number(body.minutes || 0))), reason: body.reason ? String(body.reason) : null, status: "open", createdAt: now() };
    await env.DB.prepare("INSERT INTO violations(id,employee_id,type,severity,occurred_at,minutes,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.type,record.severity,record.occurredAt,record.minutes,record.reason,record.status,record.createdAt).run();
    return json({ ok: true, violation: record }, 201);
  }
  const violationMatch = pathname.match(/^\/api\/violations\/([^/]+)$/);
  if (violationMatch && req.method === "PATCH") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const status = String((await req.json().catch(() => ({})) as any).status || "");
    if (!["open", "accepted", "rejected", "resolved"].includes(status)) return json({ error: "حالة غير صحيحة" }, 400);
    await env.DB.prepare("UPDATE violations SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?").bind(status,actor.id,now(),violationMatch[1]).run();
    return json({ ok: true, status });
  }
  if (pathname === "/api/workforce/live" && req.method === "GET") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const rows = await env.DB.prepare("SELECT e.id,e.job_number AS jobNumber,e.name,e.status,(SELECT a.type FROM attendance a WHERE a.employee_id=e.id ORDER BY a.timestamp DESC LIMIT 1) AS lastAttendanceType,(SELECT a.timestamp FROM attendance a WHERE a.employee_id=e.id ORDER BY a.timestamp DESC LIMIT 1) AS lastAttendanceAt FROM employees e ORDER BY e.name").all<any>();
    const employees = rows.results || [];
    const summary = { total: employees.length, active: employees.filter((e:any) => e.status === "active").length, checkedIn: employees.filter((e:any) => e.lastAttendanceType === "check-in").length, checkedOut: employees.filter((e:any) => e.lastAttendanceType === "check-out").length };
    return json({ generatedAt: now(), summary, employees });
  }
  return json({ error: "WORKFORCE_ROUTE_NOT_FOUND" }, 404);
}
