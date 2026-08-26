type Env = { DB: D1Database };
type Actor = { id: string; role: string } | null;

const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "cache-control": "no-store",
  },
});

const cutoffIso = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function cleanup(db: D1Database) {
  const cutoff = cutoffIso();
  await db.batch([
    db.prepare("DELETE FROM notifications WHERE created_at < ?").bind(cutoff),
    db.prepare("DELETE FROM notification_user_state WHERE deleted_at IS NOT NULL AND deleted_at < ?").bind(cutoff),
    db.prepare("DELETE FROM notification_user_state WHERE notification_id NOT IN (SELECT id FROM notifications)")
  ]).catch(() => undefined);
}

export async function handleNotificationApi(req: Request, env: Env, actor: Actor, origin: string): Promise<Response | null> {
  const path = new URL(req.url).pathname.replace(/\/$/, "") || "/";
  if (!["/api/notifications", "/api/notifications/read", "/api/notifications/deleted"].includes(path)) return null;
  if (!actor) return json({ error: "غير مصرح" }, 401, origin);

  await cleanup(env.DB);
  const userId = String(actor.id).trim();
  if (!userId) return json({ error: "المستخدم غير صالح" }, 401, origin);

  if (path === "/api/notifications" && req.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT n.id,
             n.recipient_id AS recipientId,
             n.user_id AS userId,
             n.title,
             COALESCE(NULLIF(n.body,''), n.message, '') AS body,
             COALESCE(NULLIF(n.message,''), n.body, '') AS message,
             n.severity,
             n.type,
             n.read_at AS readAt,
             n.created_at AS createdAt
      FROM notifications n
      LEFT JOIN notification_user_state s
        ON s.notification_id=n.id AND s.user_id=?
      WHERE n.recipient_id=? AND s.notification_id IS NULL
      ORDER BY n.created_at DESC
      LIMIT 500
    `).bind(userId, userId).all();
    return json(rows.results || [], 200, origin);
  }

  if (path === "/api/notifications/deleted" && req.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT notification_id AS notificationId,deleted_at AS deletedAt FROM notification_user_state WHERE user_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1000"
    ).bind(userId).all();
    return json(rows.results || [], 200, origin);
  }

  if (path === "/api/notifications" && req.method === "DELETE") {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const notificationId = String(body.id || "").trim();
    const deletedAt = new Date().toISOString();
    if (notificationId) {
      const exists = await env.DB.prepare("SELECT id FROM notifications WHERE id=? AND recipient_id=? LIMIT 1").bind(notificationId, userId).first();
      if (!exists) return json({ ok: true, deleted: false }, 200, origin);
      await env.DB.prepare(
        "INSERT INTO notification_user_state(notification_id,user_id,deleted_at) VALUES(?,?,?) ON CONFLICT(notification_id,user_id) DO UPDATE SET deleted_at=excluded.deleted_at"
      ).bind(notificationId, userId, deletedAt).run();
      return json({ ok: true, deleted: true }, 200, origin);
    }
    await env.DB.prepare(`
      INSERT INTO notification_user_state(notification_id,user_id,deleted_at)
      SELECT n.id, ?, ?
      FROM notifications n
      LEFT JOIN notification_user_state s ON s.notification_id=n.id AND s.user_id=?
      WHERE n.recipient_id=? AND s.notification_id IS NULL
    `).bind(userId, deletedAt, userId, userId).run();
    return json({ ok: true, deletedAll: true }, 200, origin);
  }

  if (path === "/api/notifications/read" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const notificationId = String(body.id || "").trim();
    const readAt = new Date().toISOString();
    if (notificationId) {
      await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND recipient_id=?").bind(readAt, notificationId, userId).run();
    } else {
      await env.DB.prepare("UPDATE notifications SET read_at=? WHERE recipient_id=? AND read_at IS NULL").bind(readAt, userId).run();
    }
    return json({ ok: true }, 200, origin);
  }

  return null;
}
