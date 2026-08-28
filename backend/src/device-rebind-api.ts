import { sendUserPush } from "./push";

type Env = { DB: D1Database; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "cache-control": "no-store" } });
const b64 = (data: ArrayBuffer | Uint8Array) => { const bytes = data instanceof Uint8Array ? data : new Uint8Array(data); let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); };
const ub64 = (v:string) => { const p=v.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((v.length+3)%4); const s=atob(p); return Uint8Array.from(s,c=>c.charCodeAt(0)); };
async function verifyPassword(password:string,stored:string){try{const[k,it,salt,hash]=String(stored||"").split("$");if(k!=="pbkdf2"||Number(it)!==100000||!salt||!hash)return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:ub64(salt),iterations:100000,hash:"SHA-256"},key,256);return b64(bits)===hash;}catch{return false;}}
async function notify(env:Env, recipientId:string, title:string, body:string, type="warning"){
  const recipient=String(recipientId||"").trim(); if(!recipient) throw new Error("NOTIFICATION_RECIPIENT_REQUIRED");
  await env.DB.prepare("INSERT INTO notifications(id,recipient_id,user_id,title,body,message,severity,type,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id(),recipient,recipient,title,body,body,type,type,now()).run();
  const subs=await env.DB.prepare("SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?").bind(recipient).all<any>();
  for(const sub of subs.results||[]){try{const result=await sendUserPush(env,{endpoint:String(sub.endpoint),keys:{p256dh:String(sub.p256dh),auth:String(sub.auth)}},{title,body,url:"/manager/requests",type,tag:"hadir-device-rebind"});if(result.status===404||result.status===410)await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(sub.id).run().catch(()=>undefined);}catch{}}
}
export async function handleDeviceRebind(request:Request,env:Env,origin:string){
  const url=new URL(request.url); if(url.pathname!=="/api/workforce/live"||request.method!=="POST")return null;
  const body=await request.json().catch(()=>({})) as any; if(String(body.action||"")!=="device-rebind-request")return null;
  const job=String(body.jobNumber||"").trim(), password=String(body.password||""); if(!job||!password)return json({error:"الرقم الوظيفي ورمز الدخول مطلوبان"},400,origin);
  const employee=await env.DB.prepare("SELECT id,job_number AS jobNumber,name,pin_hash AS pinHash,device_id AS deviceId FROM employees WHERE job_number=? AND status='active' LIMIT 1").bind(job).first<any>();
  if(!employee||!(await verifyPassword(password,employee.pinHash)))return json({error:"بيانات الموظف غير صحيحة"},401,origin);
  if(!employee.deviceId)return json({error:"هذا الحساب لا يحتوي على جهاز مرتبط"},409,origin);
  const pending=await env.DB.prepare("SELECT id FROM device_rebind_requests WHERE employee_id=? AND status='pending' LIMIT 1").bind(employee.id).first();
  if(pending)return json({ok:true,pending:true,message:"يوجد طلب إعادة ربط قيد المراجعة بالفعل"});
  const requestId=id();
  await env.DB.prepare("INSERT INTO device_rebind_requests(id,employee_id,job_number,employee_name,device_label,device_id,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(requestId,employee.id,employee.jobNumber,employee.name,String(body.deviceLabel||"الهاتف الجديد"),String(body.deviceId||""),String(body.reason||"يريد الموظف إعادة ربط حسابه بهاتف جديد"),"pending",now()).run();
  const managers=await env.DB.prepare("SELECT id FROM admin_accounts WHERE role IN ('owner','manager') AND active=1 ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END").all<{id:string}>();
  for(const manager of managers.results||[]) await notify(env,String(manager.id),"طلب إعادة ربط هاتف",`الموظف ${employee.name} (${employee.jobNumber}) يريد إعادة ربط حسابه بهاتف جديد.`);
  return json({ok:true,pending:true,requestId,message:"تم إرسال طلب إعادة ربط الهاتف، وسيبقى في إدارة الطلبات حتى تتم مراجعته."},201,origin);
}
