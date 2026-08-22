type WorkforceEnv = { DB: D1Database };
type Actor = { id: string; role: "owner" | "manager" | "supervisor" | "staff"; name?: string };
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const managerRoles = ["owner", "manager", "supervisor"];
const adminRoles = ["owner", "manager"];
function canManage(actor: Actor | null) { return !!actor && managerRoles.includes(actor.role); }
function canAdmin(actor: Actor | null) { return !!actor && adminRoles.includes(actor.role); }

export async function ensureWorkforceSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,recipient_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'info',type TEXT NOT NULL DEFAULT 'info',read_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id,created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS violations(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,type TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'warning',occurred_at TEXT NOT NULL,minutes INTEGER NOT NULL DEFAULT 0,reason TEXT,status TEXT NOT NULL DEFAULT 'open',reviewed_by TEXT,reviewed_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_violations_employee ON violations(employee_id,occurred_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status,occurred_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS leave_requests(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,type TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,reason TEXT,status TEXT NOT NULL DEFAULT 'pending',reviewer_id TEXT,reviewed_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id,start_date DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT,assignee_id TEXT,created_by TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'todo',priority TEXT NOT NULL DEFAULT 'normal',due_at TEXT,completed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id,status,due_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS performance_reviews(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,attendance_score REAL NOT NULL DEFAULT 0,punctuality_score REAL NOT NULL DEFAULT 0,reliability_score REAL NOT NULL DEFAULT 0,overall_score REAL NOT NULL DEFAULT 0,notes TEXT,reviewer_id TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_performance_employee ON performance_reviews(employee_id,period_end DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS payroll_entries(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,regular_minutes INTEGER NOT NULL DEFAULT 0,overtime_minutes INTEGER NOT NULL DEFAULT 0,late_minutes INTEGER NOT NULL DEFAULT 0,absence_minutes INTEGER NOT NULL DEFAULT 0,adjustment_amount REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'draft',approved_by TEXT,approved_at TEXT,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_entries(employee_id,period_end DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS anomaly_events(id TEXT PRIMARY KEY,employee_id TEXT,type TEXT NOT NULL,score REAL NOT NULL DEFAULT 0,evidence TEXT,status TEXT NOT NULL DEFAULT 'new',detected_at TEXT NOT NULL,resolved_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_events(status,detected_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ai_insights(id TEXT PRIMARY KEY,scope TEXT NOT NULL,scope_id TEXT,kind TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,evidence TEXT,confidence REAL,created_at TEXT NOT NULL,expires_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_insights_scope ON ai_insights(scope,scope_id,created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,endpoint TEXT NOT NULL UNIQUE,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS escape_events(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,job_number TEXT NOT NULL,employee_name TEXT NOT NULL,status TEXT NOT NULL,timestamp TEXT NOT NULL,reason TEXT,actor_id TEXT,actor_name TEXT,lat REAL,lng REAL,created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_escape_employee_time ON escape_events(employee_id,timestamp DESC)"),
  ]);
}

async function notify(db: D1Database, recipientId: string, title: string, body: string, severity = "info", type = "system") {
  await db.prepare("INSERT INTO notifications(id,recipient_id,title,body,severity,type,created_at) VALUES(?,?,?,?,?,?,?)").bind(id(),recipientId,title,body,severity,type,now()).run();
}

export async function handleWorkforce(req: Request, env: WorkforceEnv, actor: Actor | null, pathname: string) {
  if (!actor) return json({ error: "غير مصرح" }, 401);
  await ensureWorkforceSchema(env.DB);
  const url = new URL(req.url);

  if (pathname === "/api/notifications" && req.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,recipient_id AS recipientId,title,body,severity,type,read_at AS readAt,created_at AS createdAt FROM notifications WHERE recipient_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all();
    return json(rows.results || []);
  }
  if (pathname === "/api/notifications/read" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as any;
    if (body.id) await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND recipient_id=?").bind(now(), String(body.id), actor.id).run();
    else await env.DB.prepare("UPDATE notifications SET read_at=? WHERE recipient_id=? AND read_at IS NULL").bind(now(), actor.id).run();
    return json({ ok: true });
  }

  if (pathname === "/api/violations" && req.method === "GET") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 2000);
    const rows = await env.DB.prepare("SELECT v.id,v.employee_id AS employeeId,e.name AS employeeName,e.job_number AS jobNumber,v.type,v.severity,v.occurred_at AS occurredAt,v.minutes,v.reason,v.status,v.reviewed_by AS reviewedBy,v.reviewed_at AS reviewedAt,v.created_at AS createdAt FROM violations v LEFT JOIN employees e ON e.id=v.employee_id ORDER BY v.occurred_at DESC LIMIT ?").bind(limit).all();
    return json(rows.results || []);
  }
  if (pathname === "/api/violations" && req.method === "POST") {
    if (!canManage(actor)) return json({ error: "غير مصرح" }, 403);
    const body = await req.json().catch(() => ({})) as any;
    const employeeId = String(body.employeeId || "").trim(); const type = String(body.type || "other").trim();
    if (!employeeId || !type) return json({ error: "بيانات المخالفة غير مكتملة" }, 400);
    const employee = await env.DB.prepare("SELECT id FROM employees WHERE id=? LIMIT 1").bind(employeeId).first();
    if (!employee) return json({ error: "EMPLOYEE_NOT_FOUND" }, 404);
    const record = { id:id(), employeeId, type, severity:String(body.severity||"warning"), occurredAt:String(body.occurredAt||now()), minutes:Math.max(0,Math.round(Number(body.minutes||0))), reason:body.reason?String(body.reason):null, status:"open", createdAt:now() };
    await env.DB.prepare("INSERT INTO violations(id,employee_id,type,severity,occurred_at,minutes,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.type,record.severity,record.occurredAt,record.minutes,record.reason,record.status,record.createdAt).run();
    await notify(env.DB,employeeId,"مخالفة حضور جديدة",`تم تسجيل مخالفة: ${record.type}`,record.severity==="danger"?"danger":"warning","violation");
    return json({ok:true,violation:record},201);
  }
  const violationMatch=pathname.match(/^\/api\/violations\/([^/]+)$/);
  if(violationMatch&&req.method==="PATCH"){
    if(!canManage(actor))return json({error:"غير مصرح"},403); const status=String((await req.json().catch(()=>({})) as any).status||"");
    if(!["open","accepted","rejected","resolved"].includes(status))return json({error:"حالة غير صحيحة"},400);
    await env.DB.prepare("UPDATE violations SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?").bind(status,actor.id,now(),violationMatch[1]).run(); return json({ok:true,status});
  }

  if(pathname==="/api/leave-requests"&&req.method==="GET"){
    const mine=!canManage(actor)||url.searchParams.get("mine")==="1"; const rows=mine?await env.DB.prepare("SELECT * FROM leave_requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all():await env.DB.prepare("SELECT l.*,e.name AS employeeName,e.job_number AS jobNumber FROM leave_requests l LEFT JOIN employees e ON e.id=l.employee_id ORDER BY l.created_at DESC LIMIT 500").all(); return json(rows.results||[]);
  }
  if(pathname==="/api/leave-requests"&&req.method==="POST"){
    const b=await req.json().catch(()=>({})) as any; const employeeId=canManage(actor)&&b.employeeId?String(b.employeeId):actor.id; const startDate=String(b.startDate||"").trim(),endDate=String(b.endDate||"").trim(); if(!startDate||!endDate||endDate<startDate)return json({error:"فترة الإجازة غير صحيحة"},400);
    const record={id:id(),employeeId,type:String(b.type||"annual"),startDate,endDate,reason:b.reason?String(b.reason):null,status:"pending",createdAt:now()}; await env.DB.prepare("INSERT INTO leave_requests(id,employee_id,type,start_date,end_date,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.type,record.startDate,record.endDate,record.reason,record.status,record.createdAt).run(); return json({ok:true,request:record},201);
  }
  const leaveMatch=pathname.match(/^\/api\/leave-requests\/([^/]+)$/);
  if(leaveMatch&&req.method==="PATCH"){
    if(!canManage(actor))return json({error:"غير مصرح"},403); const b=await req.json().catch(()=>({})) as any; const status=String(b.status||""); if(!["approved","rejected","pending"].includes(status))return json({error:"حالة غير صحيحة"},400); await env.DB.prepare("UPDATE leave_requests SET status=?,reviewer_id=?,reviewed_at=? WHERE id=?").bind(status,actor.id,now(),leaveMatch[1]).run(); return json({ok:true,status});
  }

  if(pathname==="/api/tasks"&&req.method==="GET"){
    const mine=url.searchParams.get("mine")==="1"||!canManage(actor); const rows=mine?await env.DB.prepare("SELECT * FROM tasks WHERE assignee_id=? OR created_by=? ORDER BY due_at IS NULL,due_at ASC,created_at DESC LIMIT 500").bind(actor.id,actor.id).all():await env.DB.prepare("SELECT * FROM tasks ORDER BY due_at IS NULL,due_at ASC,created_at DESC LIMIT 1000").all(); return json(rows.results||[]);
  }
  if(pathname==="/api/tasks"&&req.method==="POST"){
    if(!canManage(actor))return json({error:"غير مصرح"},403); const b=await req.json().catch(()=>({})) as any; const title=String(b.title||"").trim(); if(!title)return json({error:"عنوان المهمة مطلوب"},400); const record={id:id(),title,description:b.description?String(b.description):null,assigneeId:b.assigneeId?String(b.assigneeId):null,createdBy:actor.id,status:"todo",priority:String(b.priority||"normal"),dueAt:b.dueAt?String(b.dueAt):null,completedAt:null,createdAt:now(),updatedAt:now()}; await env.DB.prepare("INSERT INTO tasks(id,title,description,assignee_id,created_by,status,priority,due_at,completed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(record.id,record.title,record.description,record.assigneeId,record.createdBy,record.status,record.priority,record.dueAt,record.completedAt,record.createdAt,record.updatedAt).run(); if(record.assigneeId)await notify(env.DB,record.assigneeId,"مهمة جديدة",record.title,record.priority==="urgent"?"danger":"info","task"); return json({ok:true,task:record},201);
  }
  const taskMatch=pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if(taskMatch&&req.method==="PATCH"){
    const b=await req.json().catch(()=>({})) as any; const task=await env.DB.prepare("SELECT * FROM tasks WHERE id=?").bind(taskMatch[1]).first<any>(); if(!task)return json({error:"TASK_NOT_FOUND"},404); if(!canManage(actor)&&task.assignee_id!==actor.id&&task.created_by!==actor.id)return json({error:"غير مصرح"},403); const status=b.status?String(b.status):task.status; await env.DB.prepare("UPDATE tasks SET status=?,priority=?,due_at=?,completed_at=?,updated_at=? WHERE id=?").bind(status,b.priority?String(b.priority):task.priority,b.dueAt===null?null:(b.dueAt?String(b.dueAt):task.due_at),status==="done"?now():null,now(),taskMatch[1]).run(); return json({ok:true,status});
  }

  if(pathname==="/api/performance"&&req.method==="GET"){
    const employeeId=String(url.searchParams.get("employeeId")||""); if(employeeId&&employeeId!==actor.id&&!canManage(actor))return json({error:"غير مصرح"},403); const rows=employeeId?await env.DB.prepare("SELECT * FROM performance_reviews WHERE employee_id=? ORDER BY period_end DESC LIMIT 100").bind(employeeId).all():await env.DB.prepare("SELECT * FROM performance_reviews ORDER BY period_end DESC LIMIT 500").all(); return json(rows.results||[]);
  }
  if(pathname==="/api/performance"&&req.method==="POST"){
    if(!canManage(actor))return json({error:"غير مصرح"},403); const b=await req.json().catch(()=>({})) as any; const employeeId=String(b.employeeId||""); if(!employeeId)return json({error:"الموظف مطلوب"},400); const scores=["attendanceScore","punctualityScore","reliabilityScore"].map(k=>Math.max(0,Math.min(100,Number(b[k]??0)))); const record={id:id(),employeeId,periodStart:String(b.periodStart||new Date().toISOString().slice(0,10)),periodEnd:String(b.periodEnd||new Date().toISOString().slice(0,10)),attendanceScore:scores[0],punctualityScore:scores[1],reliabilityScore:scores[2],overallScore:scores.reduce((a,v)=>a+v,0)/3,notes:b.notes?String(b.notes):null,reviewerId:actor.id,createdAt:now()}; await env.DB.prepare("INSERT INTO performance_reviews(id,employee_id,period_start,period_end,attendance_score,punctuality_score,reliability_score,overall_score,notes,reviewer_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.periodStart,record.periodEnd,record.attendanceScore,record.punctualityScore,record.reliabilityScore,record.overallScore,record.notes,record.reviewerId,record.createdAt).run(); return json({ok:true,review:record},201);
  }

  if(pathname==="/api/payroll"&&req.method==="GET"){if(!canAdmin(actor))return json({error:"غير مصرح"},403);const rows=await env.DB.prepare("SELECT p.*,e.name AS employeeName,e.job_number AS jobNumber FROM payroll_entries p LEFT JOIN employees e ON e.id=p.employee_id ORDER BY p.period_end DESC LIMIT 1000").all();return json(rows.results||[]);}
  if(pathname==="/api/payroll"&&req.method==="POST"){if(!canAdmin(actor))return json({error:"غير مصرح"},403);const b=await req.json().catch(()=>({})) as any;const record={id:id(),employeeId:String(b.employeeId||""),periodStart:String(b.periodStart||""),periodEnd:String(b.periodEnd||""),regularMinutes:Math.max(0,Number(b.regularMinutes||0)),overtimeMinutes:Math.max(0,Number(b.overtimeMinutes||0)),lateMinutes:Math.max(0,Number(b.lateMinutes||0)),absenceMinutes:Math.max(0,Number(b.absenceMinutes||0)),adjustmentAmount:Number(b.adjustmentAmount||0),status:"draft",createdAt:now()};if(!record.employeeId||!record.periodStart||!record.periodEnd)return json({error:"بيانات كشف الرواتب ناقصة"},400);await env.DB.prepare("INSERT INTO payroll_entries(id,employee_id,period_start,period_end,regular_minutes,overtime_minutes,late_minutes,absence_minutes,adjustment_amount,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.periodStart,record.periodEnd,record.regularMinutes,record.overtimeMinutes,record.lateMinutes,record.absenceMinutes,record.adjustmentAmount,record.status,record.createdAt).run();return json({ok:true,entry:record},201);}

  if(pathname==="/api/anomalies"&&req.method==="GET"){if(!canManage(actor))return json({error:"غير مصرح"},403);const rows=await env.DB.prepare("SELECT a.*,e.name AS employeeName,e.job_number AS jobNumber FROM anomaly_events a LEFT JOIN employees e ON e.id=a.employee_id ORDER BY detected_at DESC LIMIT 500").all();return json(rows.results||[]);}
  if(pathname==="/api/anomalies/scan"&&req.method==="POST"){if(!canManage(actor))return json({error:"غير مصرح"},403);const employees=await env.DB.prepare("SELECT id FROM employees WHERE status='active'").all<any>();const created:any[]=[];for(const e of employees.results||[]){const recent=await env.DB.prepare("SELECT COUNT(*) AS c FROM audit WHERE employee_id=? AND result='rejected' AND timestamp>=datetime('now','-7 day')").bind(e.id).first<any>();const count=Number(recent?.c||0);if(count>=3){const r={id:id(),employeeId:e.id,type:"repeated-rejected-actions",score:Math.min(100,50+count*10),evidence:`${count} محاولات مرفوضة خلال 7 أيام`,status:"new",detectedAt:now()};await env.DB.prepare("INSERT INTO anomaly_events(id,employee_id,type,score,evidence,status,detected_at) VALUES(?,?,?,?,?,?,?)").bind(r.id,r.employeeId,r.type,r.score,r.evidence,r.status,r.detectedAt).run();created.push(r);}}return json({ok:true,created});}
  const anomalyMatch=pathname.match(/^\/api\/anomalies\/([^/]+)$/);if(anomalyMatch&&req.method==="PATCH"){if(!canManage(actor))return json({error:"غير مصرح"},403);const b=await req.json().catch(()=>({})) as any;const status=String(b.status||"");if(!["new","reviewing","resolved","dismissed"].includes(status))return json({error:"حالة غير صحيحة"},400);await env.DB.prepare("UPDATE anomaly_events SET status=?,resolved_at=? WHERE id=?").bind(status,["resolved","dismissed"].includes(status)?now():null,anomalyMatch[1]).run();return json({ok:true,status});}

  if(pathname==="/api/ai/insights"&&req.method==="GET"){if(!canManage(actor))return json({error:"غير مصرح"},403);const rows=await env.DB.prepare("SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 100").all();return json(rows.results||[]);}
  if(pathname==="/api/ai/insights/generate"&&req.method==="POST"){if(!canManage(actor))return json({error:"غير مصرح"},403);const total=Number((await env.DB.prepare("SELECT COUNT(*) AS c FROM employees WHERE status='active'").first<any>())?.c||0);const checked=Number((await env.DB.prepare("SELECT COUNT(DISTINCT employee_id) AS c FROM attendance WHERE type='check-in' AND timestamp>=datetime('now','-1 day')").first<any>())?.c||0);const rate=total?Math.round(checked/total*100):0;const insight={id:id(),scope:"dashboard",scopeId:null,kind:"attendance-summary",title:"ملخص الحضور الذكي",summary:`نسبة الموظفين الذين سجلوا حضورًا خلال آخر 24 ساعة: ${rate}% (${checked} من ${total}).`,evidence:JSON.stringify({checked,total,rate}),confidence:.98,createdAt:now()};await env.DB.prepare("INSERT INTO ai_insights(id,scope,scope_id,kind,title,summary,evidence,confidence,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(insight.id,insight.scope,insight.scopeId,insight.kind,insight.title,insight.summary,insight.evidence,insight.confidence,insight.createdAt).run();return json({ok:true,insight},201);}

  if(pathname==="/api/escape-events"&&req.method==="GET"){if(!canManage(actor))return json({error:"غير مصرح"},403);const employeeId=url.searchParams.get("employeeId");const rows=employeeId?await env.DB.prepare("SELECT * FROM escape_events WHERE employee_id=? ORDER BY timestamp DESC LIMIT 500").bind(employeeId).all():await env.DB.prepare("SELECT x.*,e.name AS employeeName,e.job_number AS jobNumber FROM escape_events x LEFT JOIN employees e ON e.id=x.employee_id ORDER BY x.timestamp DESC LIMIT 1000").all();return json(rows.results||[]);}
  if(pathname==="/api/escape-events"&&req.method==="POST"){if(!canManage(actor))return json({error:"غير مصرح"},403);const b=await req.json().catch(()=>({})) as any;const employeeId=String(b.employeeId||"");const status=String(b.status||"");if(!employeeId||!["escaped","returned"].includes(status))return json({error:"بيانات الهروب غير صحيحة"},400);const employee=await env.DB.prepare("SELECT id,name,job_number AS jobNumber FROM employees WHERE id=?").bind(employeeId).first<any>();if(!employee)return json({error:"EMPLOYEE_NOT_FOUND"},404);const latest=await env.DB.prepare("SELECT status FROM escape_events WHERE employee_id=? ORDER BY timestamp DESC LIMIT 1").bind(employeeId).first<any>();if(status==="escaped"&&latest?.status==="escaped")return json({error:"الموظف مسجل كهارب بالفعل"},409);if(status==="returned"&&latest?.status!=="escaped")return json({error:"الموظف ليس في حالة هروب"},409);const record={id:id(),employeeId,jobNumber:employee.jobNumber,employeeName:employee.name,status,timestamp:now(),reason:b.reason?String(b.reason):null,actorId:actor.id,actorName:actor.name||null,lat:b.lat==null?null:Number(b.lat),lng:b.lng==null?null:Number(b.lng),createdAt:now()};await env.DB.prepare("INSERT INTO escape_events(id,employee_id,job_number,employee_name,status,timestamp,reason,actor_id,actor_name,lat,lng,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(record.id,record.employeeId,record.jobNumber,record.employeeName,record.status,record.timestamp,record.reason,record.actorId,record.actorName,record.lat,record.lng,record.createdAt).run();await notify(env.DB,employeeId,status==="escaped"?"تم تسجيل هروبك":"تم تسجيل عودتك للعمل",status==="escaped"?"تم تسجيل حالة هروب من الإدارة":"تم تسجيل عودتك للعمل",status==="escaped"?"danger":"success","escape");return json({ok:true,event:record},201);}

  if(pathname==="/api/push/subscriptions"&&req.method==="POST"){const b=await req.json().catch(()=>({})) as any;if(!b.endpoint||!b.p256dh||!b.auth)return json({error:"بيانات Push غير مكتملة"},400);const existing=await env.DB.prepare("SELECT id FROM push_subscriptions WHERE endpoint=?").bind(String(b.endpoint)).first<any>();if(existing)await env.DB.prepare("UPDATE push_subscriptions SET user_id=?,p256dh=?,auth=?,last_seen_at=? WHERE id=?").bind(actor.id,String(b.p256dh),String(b.auth),now(),existing.id).run();else await env.DB.prepare("INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,created_at,last_seen_at) VALUES(?,?,?,?,?,?,?)").bind(id(),actor.id,String(b.endpoint),String(b.p256dh),String(b.auth),now(),now()).run();return json({ok:true});}
  if(pathname==="/api/push/subscriptions"&&req.method==="DELETE"){const b=await req.json().catch(()=>({})) as any;if(b.endpoint)await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?").bind(String(b.endpoint),actor.id).run();return json({ok:true});}

  return json({error:"WORKFORCE_ROUTE_NOT_FOUND"},404);
}
