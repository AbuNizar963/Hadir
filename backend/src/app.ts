type Env = { DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket };
const original = (await import("./recovery")).default;
const uid = () => crypto.randomUUID();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" } });
async function actorFromOriginal(req: Request, env: Env) { const url = new URL(req.url); url.pathname = "/api/me"; url.search = ""; const probe = await original.fetch(new Request(url, { method: "GET", headers: req.headers }), env, {} as ExecutionContext); if (!probe.ok) return null; return (await probe.json().catch(() => ({})) as any).user || null; }
async function ensureWorkflowSchema(db: D1Database) { await db.batch([db.prepare("CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'info',read_at TEXT,created_at TEXT NOT NULL)"),db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at DESC)")]); }
async function notify(db: D1Database, userId: string, title: string, message: string, type = "info") { await db.prepare("INSERT INTO notifications(id,user_id,title,message,type,created_at) VALUES(?,?,?,?,?,?)").bind(uid(), userId, title, message, type, new Date().toISOString()).run(); }
function avatarKey(employeeId: string) { return `employees/${employeeId}/avatar.webp`; }
export default { async fetch(req: Request, env: Env, ctx: ExecutionContext) {
 const origin=env.APP_ORIGIN||"*"; if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-headers":"content-type, authorization, x-device-id","access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS"}});
 if(!env.DB)return json({ok:false,error:"D1 binding DB غير موجود"},503,origin);
 await ensureWorkflowSchema(env.DB); const url=new URL(req.url); const path=url.pathname.replace(/\/$/,"")||"/"; const actor=await actorFromOriginal(req,env);
 const avatarMatch=path.match(/^\/api\/employees\/([^/]+)\/avatar$/);
 if(avatarMatch && req.method==="POST") {
   if(!env.PROFILE_IMAGES)return json({ok:false,error:"R2 binding PROFILE_IMAGES غير موجود"},503,origin);
   if(!actor || !["owner","manager"].includes(actor.role)) return json({error:"المالك أو المدير فقط"},403,origin);
   const employeeId=decodeURIComponent(avatarMatch[1]);
   const employee=await env.DB.prepare("SELECT id,avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
   if(!employee) return json({error:"EMPLOYEE_NOT_FOUND"},404,origin);
   const contentType=req.headers.get("content-type")||"";
   if(!contentType.toLowerCase().includes("multipart/form-data")) return json({error:"MULTIPART_FORM_DATA_REQUIRED"},415,origin);
   const form=await req.formData(); const file=form.get("file");
   if(!(file instanceof File)) return json({error:"IMAGE_FILE_REQUIRED"},400,origin);
   if(file.type!=="image/webp") return json({error:"WEBP_REQUIRED"},415,origin);
   if(file.size===0 || file.size>100*1024) return json({error:"IMAGE_TOO_LARGE",maxBytes:100*1024},413,origin);
   const key=avatarKey(employeeId);
   await env.PROFILE_IMAGES.put(key, await file.arrayBuffer(), { httpMetadata:{contentType:"image/webp",cacheControl:"private, max-age=31536000, immutable"}, customMetadata:{employeeId} });
   try { await env.DB.prepare("UPDATE employees SET avatar=? WHERE id=?").bind(key,employeeId).run(); }
   catch(error) { await env.PROFILE_IMAGES.delete(key).catch(()=>undefined); return json({error:"AVATAR_DB_UPDATE_FAILED",detail:error instanceof Error?error.message:String(error)},500,origin); }
   return json({ok:true,key,size:file.size,contentType:"image/webp"},200,origin);
 }
 if(avatarMatch && req.method==="GET") {
   if(!env.PROFILE_IMAGES)return json({ok:false,error:"R2 binding PROFILE_IMAGES غير موجود"},503,origin);
   if(!actor) return json({error:"غير مصرح"},401,origin);
   const employeeId=decodeURIComponent(avatarMatch[1]);
   if(actor.role==="staff" && actor.id!==employeeId) return json({error:"غير مصرح"},403,origin);
   if(!["owner","manager","supervisor","staff"].includes(actor.role)) return json({error:"غير مصرح"},403,origin);
   const row=await env.DB.prepare("SELECT avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<{avatar:string|null}>();
   if(!row) return json({error:"EMPLOYEE_NOT_FOUND"},404,origin);
   if(!row.avatar) return new Response(null,{status:404,headers:{"access-control-allow-origin":origin}});
   const object=await env.PROFILE_IMAGES.get(row.avatar);
   if(!object) return new Response(null,{status:404,headers:{"access-control-allow-origin":origin}});
   const headers=new Headers({"access-control-allow-origin":origin,"cache-control":"private, max-age=300"}); object.writeHttpMetadata(headers); headers.set("etag",object.httpEtag); return new Response(object.body,{status:200,headers});
 }
 if(avatarMatch && req.method==="DELETE") {
   if(!env.PROFILE_IMAGES)return json({ok:false,error:"R2 binding PROFILE_IMAGES غير موجود"},503,origin);
   if(!actor || !["owner","manager"].includes(actor.role)) return json({error:"المالك أو المدير فقط"},403,origin);
   const employeeId=decodeURIComponent(avatarMatch[1]); const row=await env.DB.prepare("SELECT avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<{avatar:string|null}>();
   if(!row) return json({error:"EMPLOYEE_NOT_FOUND"},404,origin);
   if(row.avatar) await env.PROFILE_IMAGES.delete(row.avatar);
   await env.DB.prepare("UPDATE employees SET avatar=NULL WHERE id=?").bind(employeeId).run();
   return json({ok:true},200,origin);
 }
 if(path==="/api/settings"&&req.method==="GET"){if(!actor||!["owner","manager","supervisor"].includes(actor.role))return json({error:"غير مصرح"},403,origin);const rows=await env.DB.prepare("SELECT key,value FROM settings ORDER BY key").all<any>();const out:any={};for(const r of rows.results||[]){try{out[r.key]=JSON.parse(r.value)}catch{out[r.key]=r.value}}return json(out,200,origin);}
 if(path==="/api/settings"&&req.method==="PUT"){if(!actor||!["owner","manager"].includes(actor.role))return json({error:"المالك أو المدير فقط"},403,origin);const b=await req.json().catch(()=>({})) as Record<string,unknown>;const entries=Object.entries(b).filter(([k])=>k!=="ownerPasswordHash");for(const [key,value] of entries)await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,JSON.stringify(value)).run();return json({ok:true},200,origin);}
 if(path==="/api/locations"&&req.method==="GET"){if(!actor||!["owner","manager","supervisor","staff"].includes(actor.role))return json({error:"غير مصرح"},403,origin);const rows=await env.DB.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name").all<any>();return json(rows.results||[],200,origin);}
 if(path==="/api/locations"&&req.method==="PUT"){if(!actor||!["owner","manager"].includes(actor.role))return json({error:"المالك أو المدير فقط"},403,origin);const b=await req.json().catch(()=>({})) as any;const id=String(b.id||uid()),name=String(b.name||"").trim(),lat=Number(b.lat),lng=Number(b.lng),radiusMeters=Number(b.radiusMeters);if(!name||!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(radiusMeters)||radiusMeters<=0)return json({error:"بيانات الموقع غير صحيحة"},400,origin);await env.DB.prepare("INSERT INTO locations(id,name,lat,lng,radius_meters) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lng=excluded.lng,radius_meters=excluded.radius_meters").bind(id,name,lat,lng,radiusMeters).run();return json({ok:true,location:{id,name,lat,lng,radiusMeters}},200,origin);}
 if(path.startsWith("/api/locations/")&&req.method==="DELETE"){if(!actor||!["owner","manager"].includes(actor.role))return json({error:"المالك أو المدير فقط"},403,origin);const id=decodeURIComponent(path.slice("/api/locations/".length));await env.DB.prepare("UPDATE employees SET location_id=NULL WHERE location_id=?").bind(id).run();await env.DB.prepare("DELETE FROM locations WHERE id=?").bind(id).run();return json({ok:true},200,origin);}
 if(path==="/api/notifications"&&req.method==="GET"){if(!actor)return json({error:"غير مصرح"},401,origin);const rows=await env.DB.prepare("SELECT id,user_id AS userId,title,message,type,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all();return json(rows.results||[],200,origin);}
 if(path==="/api/notifications/read"&&req.method==="POST"){if(!actor)return json({error:"غير مصرح"},401,origin);const b=await req.json().catch(()=>({})) as any;if(b.id)await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(new Date().toISOString(),String(b.id),actor.id).run();else await env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(new Date().toISOString(),actor.id).run();return json({ok:true},200,origin);}
 const requestMatch=path.match(/^\/api\/requests\/([^/]+)$/);const confirmMatch=path.match(/^\/api\/requests\/([^/]+)\/confirm$/);
 if(path==="/api/requests"&&req.method==="GET"){if(!actor||!["owner","manager","supervisor","staff"].includes(actor.role))return json({error:"غير مصرح"},401,origin);const rows=actor.role==="staff"?await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests WHERE employee_id=? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all():await env.DB.prepare("SELECT id,employee_id AS employeeId,employee_name AS employeeName,job_number AS jobNumber,type,reason,status,created_at AS createdAt FROM requests ORDER BY created_at DESC LIMIT 500").all();return json(rows.results||[],200,origin);}
 if(path==="/api/requests"&&req.method==="POST"){if(!actor||actor.role!=="staff")return json({error:"الموظف فقط يستطيع إنشاء الطلب"},403,origin);const b=await req.json().catch(()=>({})) as any;const type=String(b.type||b.requestType||"");if(!["permission","leave","checkout"].includes(type))return json({error:"نوع الطلب غير صحيح"},400,origin);const employee=await env.DB.prepare("SELECT job_number AS jobNumber,name FROM employees WHERE id=? AND status='active' LIMIT 1").bind(actor.id).first<any>();if(!employee)return json({error:"الموظف غير موجود"},404,origin);const id=uid();await env.DB.prepare("INSERT INTO requests(id,employee_id,employee_name,job_number,type,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,actor.id,employee.name,employee.jobNumber,type,String(b.reason||""),"pending",new Date().toISOString()).run();const admins=await env.DB.prepare("SELECT id FROM admin_accounts WHERE active=1 AND role IN ('owner','manager')").all<any>();for(const a of admins.results||[])await notify(env.DB,a.id,"طلب موظف جديد",`${employee.name} أرسل طلب ${type==="permission"?"استئذان":type==="leave"?"إجازة":"انصراف"}.`,"info");return json({ok:true,id,status:"pending"},201,origin);}
 if(requestMatch&&req.method==="PATCH"){if(!actor||!["owner","manager"].includes(actor.role))return json({error:"غير مصرح"},403,origin);const id=requestMatch[1];const b=await req.json().catch(()=>({})) as any;const status=String(b.status||"");if(!["approved","rejected"].includes(status))return json({error:"حالة غير صحيحة"},400,origin);const r=await env.DB.prepare("SELECT employee_id AS employeeId FROM requests WHERE id=? AND status='pending' LIMIT 1").bind(id).first<any>();if(!r)return json({error:"الطلب غير موجود أو تمت مراجعته"},409,origin);await env.DB.prepare("UPDATE requests SET status=? WHERE id=? AND status='pending'").bind(status,id).run();await notify(env.DB,r.employeeId,status==="approved"?"تمت الموافقة":"تم رفض الطلب",status==="approved"?"تمت الموافقة من قبل المدير أو المالك، يمكنك الآن تأكيد العملية.":"تم رفض طلبك من قبل المدير أو المالك.",status==="approved"?"success":"warning");return json({ok:true,status},200,origin);}
 if(confirmMatch&&req.method==="POST"){if(!actor||actor.role!=="staff")return json({error:"غير مصرح"},403,origin);const id=confirmMatch[1];const result=await env.DB.prepare("UPDATE requests SET status='confirmed' WHERE id=? AND employee_id=? AND status='approved'").bind(id,actor.id).run();if(!result.meta.changes)return json({error:"لا يمكن التأكيد قبل موافقة المدير"},403,origin);return json({ok:true,status:"confirmed"},200,origin);}
 return original.fetch(req,env,ctx);
}};
