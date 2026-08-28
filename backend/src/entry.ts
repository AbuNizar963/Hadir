import app from "./app";
import { HadirRealtime } from "./realtime";
import { bindEmployeeDevice, clearEmployeeDevice, deviceStatus, registrationOptions, verifyRegistration } from "./deviceSecurity";
import { handleWorkforce } from "./workforce";

type Env = { REALTIME: DurableObjectNamespace; DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket; WEBAUTHN_RP_ID?: string; WEBAUTHN_ORIGIN?: string };
const SESSION_COOKIE = "hadir_session";
const cors = (origin: string) => ({ "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, x-device-id", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-max-age": "86400", "cache-control": "no-store" });
function configuredOrigins(env: Env): string[] { return String(env.APP_ORIGIN || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean); }
function responseOrigin(request: Request, env: Env): string { const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, ""); const allowed = configuredOrigins(env); if (!incoming) return allowed[0] || "*"; return allowed.length === 0 || allowed.includes(incoming) ? incoming : allowed[0] || "*"; }
function readCookie(request: Request, name: string): string | null { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length+1)) : null; }
async function hashToken(token: string) { const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)); let binary=""; for(const byte of new Uint8Array(digest)) binary+=String.fromCharCode(byte); return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
async function actorIdFromSession(request: Request, env: Env): Promise<string|null> { const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim(); if(!token||!env.DB)return null; try { const tokenHash=await hashToken(token); const row=await env.DB.prepare("SELECT user_id AS userId FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(tokenHash).first<{userId:string}>(); return row?.userId||null; } catch { return null; } }
async function actorFromSession(request: Request, env: Env): Promise<any|null> { const id=await actorIdFromSession(request,env); if(!id)return null; return env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,role,device_id AS deviceId,device_label AS deviceLabel FROM employees WHERE id=? LIMIT 1").bind(id).first<any>(); }
async function actorForAdministrativeAction(request: Request, env: Env): Promise<any|null> {
  try {
    const url = new URL(request.url); url.pathname = "/api/me"; url.search = "";
    const probe = await app.fetch(new Request(url, { method: "GET", headers: request.headers }), env, {} as ExecutionContext);
    if (probe.ok) { const data = await probe.json().catch(() => ({})) as any; if (data?.user) return data.user; }
  } catch {}
  return actorFromSession(request, env);
}
function realtimeId(env: Env) { return env.REALTIME.idFromName("hadir-global"); }
async function broadcast(env: Env, payload: Record<string, unknown>) { if(!env.REALTIME)return; const stub=env.REALTIME.get(realtimeId(env)); await stub.fetch("https://realtime/broadcast",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).catch(()=>undefined); }
function validDeviceId(value: string|null): value is string { return Boolean(value&&value.trim().length>=8&&value.trim().length<=200); }
function readDeviceCookie(request: Request) { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith("hadir_device_id=")); return item?decodeURIComponent(item.slice("hadir_device_id=".length)):null; }
function createDeviceId() { return `dev-cookie-${crypto.randomUUID()}`; }
async function ensureDeviceIdentity(request: Request): Promise<{request:Request;deviceId:string;setCookie:boolean}> { const headerId=request.headers.get("x-device-id")?.trim()||null; const cookieId=readDeviceCookie(request); const deviceId=validDeviceId(headerId)?headerId:validDeviceId(cookieId)?cookieId:createDeviceId(); const headers=new Headers(request.headers); headers.set("x-device-id",deviceId); if(new URL(request.url).pathname==="/api/auth/login"&&request.method==="POST"&&(request.headers.get("content-type")||"").includes("application/json")){ const body=await request.clone().json().catch(()=>null) as Record<string,unknown>|null; const nextBody=body?JSON.stringify({...body,deviceId:String(body.deviceId||"").trim()||deviceId,deviceLabel:String(body.deviceLabel||"").trim()||"متصفح الهاتف"}):undefined; return {request:new Request(request,{headers,body:nextBody}),deviceId,setCookie:!validDeviceId(cookieId)||cookieId!==deviceId}; } return {request:new Request(request,{headers}),deviceId,setCookie:!validDeviceId(cookieId)||cookieId!==deviceId}; }
function addDeviceCookie(response:Response,deviceId:string,setCookie:boolean,origin:string):Response { const headers=new Headers(response.headers); headers.set("access-control-allow-origin",origin); headers.set("access-control-allow-credentials","true"); headers.set("access-control-allow-headers","content-type, authorization, x-device-id"); headers.set("access-control-allow-methods","GET,POST,PATCH,PUT,DELETE,OPTIONS"); headers.set("cache-control","no-store"); if(setCookie) headers.append("Set-Cookie",`hadir_device_id=${encodeURIComponent(deviceId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`); return new Response(response.body,{status:response.status,statusText:response.statusText,headers}); }
function errorResponse(error: unknown, origin: string) { const message = error instanceof Error ? error.message : "Internal Worker error"; return new Response(JSON.stringify({ok:false,error:message}),{status:500,headers:{...cors(origin),"content-type":"application/json; charset=utf-8"}}); }

export { HadirRealtime };
export default { async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response> {
  const origin=responseOrigin(request,env); if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  try {
    const url=new URL(request.url);
    if(url.pathname==="/api/realtime"&&request.method==="GET"){ const userId=await actorIdFromSession(request,env); if(!userId)return new Response("غير مصرح",{status:401,headers:cors(origin)}); if(!env.REALTIME)return new Response("Realtime غير مفعّل",{status:503,headers:cors(origin)}); const response=await env.REALTIME.get(realtimeId(env)).fetch(new URL("https://realtime/connect?userId="+encodeURIComponent(userId)),{method:"GET"}); return response.status===101?response:new Response("Realtime connection failed",{status:502,headers:cors(origin)}); }
    const prepared=await ensureDeviceIdentity(request);
    const mutation=["POST","PUT","PATCH","DELETE"].includes(request.method)&&url.pathname.startsWith("/api/");
    if(url.pathname==="/api/auth/login"&&request.method==="POST"){
      const loginBody=await prepared.request.clone().json().catch(()=>({})) as any;
      const response=await app.fetch(prepared.request,env,ctx);
      const data=await response.clone().json().catch(()=>({})) as any;
      if(response.ok&&data.kind==="employee"&&data.user?.id&&typeof data.token==="string"){
        const fingerprint=String(loginBody.deviceFingerprint||"").trim();
        const deviceId=String(loginBody.deviceId||prepared.deviceId).trim();
        const label=String(loginBody.deviceLabel||"متصفح الهاتف").trim();
        const result=await bindEmployeeDevice(env,String(data.user.id),deviceId,label,fingerprint);
        if(!result.bound){
          const logoutRequest=new Request(new URL("/api/auth/logout",request.url),{method:"POST",headers:new Headers({"authorization":`Bearer ${data.token}`,"content-type":"application/json","origin":origin}),body:"{}"});
          await app.fetch(logoutRequest,env,ctx).catch(()=>undefined);
          await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),data.user.id,data.user.jobNumber||data.user.username||"",data.user.name||"","device-bind","rejected","الجهاز أو بصمة المتصفح غير مطابقة للجهاز المسجل",new Date().toISOString(),deviceId,request.headers.get("CF-Connecting-IP")||"unknown").run().catch(()=>undefined);
          return addDeviceCookie(new Response(JSON.stringify({ok:false,error:"هذا الحساب مرتبط بهاتف آخر. راجع الإدارة لفك ربط الجهاز."}),{status:403,headers:{...cors(origin),"content-type":"application/json; charset=utf-8"}}),prepared.deviceId,prepared.setCookie,origin);
        }
      }
      return addDeviceCookie(response,prepared.deviceId,prepared.setCookie,origin);
    }

    const actor=await actorFromSession(request,env);
    const workforceActor = (url.pathname === "/api/notifications" || url.pathname === "/api/notifications/read" || url.pathname === "/api/violations" || url.pathname.startsWith("/api/violations/") || url.pathname === "/api/workforce/live" || url.pathname === "/api/device-rebind-requests" || url.pathname === "/api/workforce/reset" || url.pathname === "/api/workforce/reset-test-data") ? await actorForAdministrativeAction(request,env) : actor;
    if(url.pathname==="/api/notifications"||url.pathname==="/api/notifications/read"||url.pathname==="/api/violations"||url.pathname.startsWith("/api/violations/")||url.pathname==="/api/workforce/live"||url.pathname==="/api/device-rebind-requests"||url.pathname==="/api/workforce/reset"||url.pathname==="/api/workforce/reset-test-data"){
      const workforceResponse=await handleWorkforce(prepared.request,env,workforceActor,url.pathname);
      if(workforceResponse.status!==404)return addDeviceCookie(workforceResponse,prepared.deviceId,prepared.setCookie,origin);
    }
    if(url.pathname==="/api/device/status"&&request.method==="GET"){ if(!actor||actor.role!=="staff")return new Response(JSON.stringify({error:"غير مصرح"}),{status:403,headers:{...cors(origin),"content-type":"application/json"}}); return new Response(JSON.stringify(await deviceStatus(env,actor.id)),{status:200,headers:{...cors(origin),"content-type":"application/json"}}); }
    if(url.pathname==="/api/device/passkey/registration/options"&&request.method==="GET"){ if(!actor||actor.role!=="staff")return new Response(JSON.stringify({error:"غير مصرح"}),{status:403,headers:{...cors(origin),"content-type":"application/json"}}); const options=await registrationOptions(env,actor.id,actor.jobNumber,actor.name); return new Response(JSON.stringify(options),{status:200,headers:{...cors(origin),"content-type":"application/json"}}); }
    if(url.pathname==="/api/device/passkey/registration/verify"&&request.method==="POST"){ if(!actor||actor.role!=="staff")return new Response(JSON.stringify({error:"غير مصرح"}),{status:403,headers:{...cors(origin),"content-type":"application/json"}}); const body=await request.json().catch(()=>null); if(!body)return new Response(JSON.stringify({error:"بيانات مفتاح الجهاز غير صالحة"}),{status:400,headers:{...cors(origin),"content-type":"application/json"}}); const result=await verifyRegistration(env,actor.id,body); return new Response(JSON.stringify(result),{status:200,headers:{...cors(origin),"content-type":"application/json"}}); }

    if(url.pathname==="/api/manager/attendance"&&request.method==="POST"){
      const admin=await actorForAdministrativeAction(request,env);
      if(!admin||String(admin.role).toLowerCase()!=="owner") return new Response(JSON.stringify({error:"المالك فقط يستطيع التحضير المباشر"}),{status:403,headers:{...cors(origin),"content-type":"application/json"}});
      const b=await request.json().catch(()=>({})) as any;
      const employeeId=String(b.employeeId||"").trim(); const type=String(b.type||"check-in");
      if(!employeeId||type!=="check-in") return new Response(JSON.stringify({error:"بيانات التحضير المباشر غير صحيحة"}),{status:400,headers:{...cors(origin),"content-type":"application/json"}});
      const employee=await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,location_id AS locationId FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
      if(!employee||employee.status!=="active") return new Response(JSON.stringify({error:"الموظف غير موجود أو موقوف"}),{status:404,headers:{...cors(origin),"content-type":"application/json"}});
      const last=await env.DB.prepare("SELECT type FROM attendance WHERE employee_id=? ORDER BY timestamp DESC LIMIT 1").bind(employeeId).first<any>();
      if(last?.type==="check-in") return new Response(JSON.stringify({error:"الموظف مسجل حضور بالفعل"}),{status:409,headers:{...cors(origin),"content-type":"application/json"}});
      const location=(await env.DB.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations WHERE id=? LIMIT 1").bind(employee.locationId||"main").first<any>()) || (await env.DB.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name LIMIT 1").first<any>());
      if(!location) return new Response(JSON.stringify({error:"لا يوجد موقع عمل محفوظ"}),{status:409,headers:{...cors(origin),"content-type":"application/json"}});
      const id=crypto.randomUUID(); const timestamp=new Date().toISOString(); const deviceId=`admin-direct:${admin.id}`; const ip=request.headers.get("CF-Connecting-IP")||"unknown";
      await env.DB.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,employee.id,employee.jobNumber,employee.name,"check-in",timestamp,Number(location.lat),Number(location.lng),0,deviceId,ip,"ADMIN_DIRECT",location.id).run();
      await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),employee.id,employee.jobNumber,admin.name,"check-in","success","تحضير مباشر بواسطة الإدارة لمهمة/مأمورية",timestamp,deviceId,ip,Number(location.lat),Number(location.lng),0).run().catch(()=>undefined);
      await broadcast(env,{type:"cloud-data-changed",timestamp,path:"/api/attendance",method:"POST"});
      return new Response(JSON.stringify({ok:true,record:{id,employeeId:employee.id,jobNumber:employee.jobNumber,employeeName:employee.name,type:"check-in",timestamp,lat:Number(location.lat),lng:Number(location.lng),distanceMeters:0,deviceId,ip,qrCode:"ADMIN_DIRECT",locationId:location.id}}),{status:201,headers:{...cors(origin),"content-type":"application/json"}});
    }

    const deviceReset=url.pathname.match(/^\/api\/employees\/([^/]+)\/device$/);
    if(deviceReset&&request.method==="DELETE"){
      const admin=await actorForAdministrativeAction(request,env);
      if(!admin||!["owner","manager","supervisor"].includes(String(admin.role).toLowerCase()))return new Response(JSON.stringify({error:"المالك أو المدير أو المشرف فقط"}),{status:403,headers:{...cors(origin),"content-type":"application/json"}});
      const employeeId=decodeURIComponent(deviceReset[1]);
      const employee=await env.DB.prepare("SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
      if(!employee)return new Response(JSON.stringify({error:"الموظف غير موجود"}),{status:404,headers:{...cors(origin),"content-type":"application/json"}});
      await clearEmployeeDevice(env,employeeId);
      await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),employee.id,employee.jobNumber||"",admin.name||"الإدارة", "device-unbind","success","تم فك ربط جهاز الموظف",new Date().toISOString(),request.headers.get("x-device-id")||"unknown",request.headers.get("CF-Connecting-IP")||"unknown").run().catch(()=>undefined);
      await broadcast(env,{type:"employee-device-unbound",employeeId:employee.id,timestamp:new Date().toISOString()});
      return new Response(JSON.stringify({ok:true,employeeId:employee.id}),{status:200,headers:{...cors(origin),"content-type":"application/json"}});
    }

    const response=await app.fetch(prepared.request,env,ctx);
    if(mutation&&response.ok)ctx.waitUntil(broadcast(env,{type:"cloud-data-changed",timestamp:new Date().toISOString(),path:url.pathname,method:request.method}));
    return addDeviceCookie(response,prepared.deviceId,prepared.setCookie,origin);
  } catch(error) { return errorResponse(error,origin); }
} };