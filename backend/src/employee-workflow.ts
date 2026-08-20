import { Hono } from 'hono';

type Bindings = { DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();
const id = () => crypto.randomUUID();

app.get('/api/employee/:employeeId/history', async (c) => {
  const employeeId = c.req.param('employeeId');
  const rows = await c.env.DB.prepare(`SELECT * FROM employee_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 200`).bind(employeeId).all();
  return c.json({ requests: rows.results ?? [] });
});

app.get('/api/notifications/:userId', async (c) => {
  const userId = c.req.param('userId');
  const rows = await c.env.DB.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).bind(userId).all();
  return c.json({ notifications: rows.results ?? [] });
});

app.post('/api/notifications/:userId/read', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json<{ id?: string }>();
  if (body.id) await c.env.DB.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(body.id, userId).run();
  else await c.env.DB.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`).bind(userId).run();
  return c.json({ ok: true });
});

app.post('/api/employee/:employeeId/requests', async (c) => {
  const employeeId = c.req.param('employeeId');
  const body = await c.req.json<{ requestType: 'permission'|'leave'|'checkout'; reason?: string }>();
  if (!['permission','leave','checkout'].includes(body.requestType)) return c.json({ error: 'invalid request type' }, 400);
  const requestId = id();
  await c.env.DB.prepare(`INSERT INTO employee_requests (id, employee_id, request_type, reason) VALUES (?, ?, ?, ?)`).bind(requestId, employeeId, body.requestType, body.reason ?? null).run();
  return c.json({ ok: true, requestId, status: 'pending' }, 201);
});

app.post('/api/employee-requests/:requestId/review', async (c) => {
  const requestId = c.req.param('requestId');
  const body = await c.req.json<{ status: 'approved'|'rejected'; reviewerId: string; employeeId: string; title?: string }>();
  if (!['approved','rejected'].includes(body.status)) return c.json({ error: 'invalid status' }, 400);
  const result = await c.env.DB.prepare(`UPDATE employee_requests SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ? AND status = 'pending'`).bind(body.status, body.reviewerId, requestId).run();
  if (!result.meta.changes) return c.json({ error: 'request not pending' }, 409);
  await c.env.DB.prepare(`INSERT INTO notifications (id,user_id,title,message,type) VALUES (?,?,?,?,?)`).bind(
    id(), body.employeeId, body.title ?? (body.status === 'approved' ? 'تمت الموافقة' : 'تم رفض الطلب'),
    body.status === 'approved' ? 'تمت الموافقة من قبل المدير، يمكنك الآن تأكيد العملية.' : 'تم رفض طلبك من قبل المدير.',
    body.status === 'approved' ? 'success' : 'warning'
  ).run();
  return c.json({ ok: true });
});

app.post('/api/employee-requests/:requestId/confirm', async (c) => {
  const requestId = c.req.param('requestId');
  const body = await c.req.json<{ employeeId: string }>();
  const result = await c.env.DB.prepare(`UPDATE employee_requests SET status='confirmed', confirmed_at=datetime('now') WHERE id=? AND employee_id=? AND status='approved'`).bind(requestId, body.employeeId).run();
  if (!result.meta.changes) return c.json({ error: 'approval required' }, 403);
  return c.json({ ok: true });
});

export default app;
