import app from "./app";
import { HadirRealtime } from "./realtime";

type Env = { REALTIME: DurableObjectNamespace; DB: D1Database; JWT_SECRET?: string; APP_ORIGIN?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket };
const SESSION_COOKIE = "hadir_session";
const cors = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type, authorization, x-device-id",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
});
function configuredOrigins(env: Env): string[] { return String(env.APP_ORIGIN || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean); }
function responseOrigin(request: Request, env: Env): string {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const allowed = configuredOrigins(env);
  if (!incoming) return allowed[0] || "*";
  return allowed.length === 0 || allowed.includes(incoming) ? incoming : allowed[0] || "*";
}
function readCookie(request: Request, name: string): string | null { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length+1)) : null; }
async function hashToken(token: string) { const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)); let binary=""; for(const byte of new Uint8Array(digest)) binary+=String.fromCharCode(byte); return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
async function actorIdFromSession(request: Request, env: Env): Promise<string|null> { const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim(); if(!token||!env.DB)return null; try { const tokenHash=await hashToken(token); const row=await env.DB.prepare("SELECT user_id AS userId FROM auth_sessions WHERE token_hash=? LIMIT 1").bind(tokenHash).first<{userId:string}>(); return row?.userId||null; } catch { return null; } }
function realtimeId(env: Env) { return env.REALTIME.idFromName("hadir-global"); }
async function broadcast(env: Env, payload: Record<string, unknown>) { if(!env.REALTIME)return; const stub=env.REALTIME.get(realtimeId(env)); await stub.fetch("https://realtime/broadcast",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).catch(()=>undefined); }
function validDeviceId(value: string|null): value is string { return Boolean(value&&value.trim().length>=8&&value.trim().length<=200); }
function readDeviceCookie(request: Request) { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith("hadir_device_id=")); return item?decodeURIComponent(item.slice("hadir_device_id=".length)):null; }
function createDeviceId() { return `dev-cookie-${crypto.randomUUID()}`; }
async function ensureDeviceIdentity(request: Request): Promise<{request:Request;deviceId:string;setCookie:boolean}> {
  const headerId=request.headers.get("x-device-id")?.trim()||null;
  const cookieId=readDeviceCookie(request);
  const deviceId=validDeviceId(headerId)?headerId:validDeviceId(cookieId)?cookieId:createDeviceId();
  const headers=new Headers(request.headers); headers.set("x-device-id",deviceId);
  if(new URL(request.url).pathname==="/api/auth/login"&&request.method==="POST"&&(request.headers.get("content-type")||"").includes("application/json")){
    const body=await request.clone().json().catch(()=>null) as Record<string,unknown>|null;
    const nextBody=body?JSON.stringify({...body,deviceId:String(body.deviceId||"").trim()||deviceId,deviceLabel:String(body.deviceLabel||"").trim()||"متصفح الهاتف"}):undefined;
    return {request:new Request(request,{headers,body:nextBody}),deviceId,setCookie:!validDeviceId(cookieId)||cookieId!==deviceId};
  }
  return {request:new Request(request,{headers}),deviceId,setCookie:!validDeviceId(cookieId)||cookieId!==deviceId};
}
function addDeviceCookie(response:Response,deviceId:string,setCookie:boolean,origin:string):Response {
  const headers=new Headers(response.headers); headers.set("access-control-allow-origin",origin); headers.set("access-control-allow-credentials","true"); headers.set("access-control-allow-headers","content-type, authorization, x-device-id"); headers.set("access-control-allow-methods","GET,POST,PATCH,PUT,DELETE,OPTIONS"); headers.set("cache-control","no-store");
  if(setCookie) headers.append("Set-Cookie",`hadir_device_id=${encodeURIComponent(deviceId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function errorResponse(error: unknown, origin: string) { const message = error instanceof Error ? error.message : "Internal Worker error"; return new Response(JSON.stringify({ok:false,error:message}),{status:500,headers:{...cors(origin),"content-type":"application/json; charset=utf-8"}}); }
export { HadirRealtime };
export default { async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response> {
  const origin=responseOrigin(request,env);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  try {
    const url=new URL(request.url);
    if(url.pathname==="/api/realtime"&&request.method==="GET"){
      const userId=await actorIdFromSession(request,env); if(!userId)return new Response("غير مصرح",{status:401,headers:cors(origin)});
      if(!env.REALTIME)return new Response("Realtime غير مفعّل",{status:503,headers:cors(origin)});
      const response=await env.REALTIME.get(realtimeId(env)).fetch(new URL("https://realtime/connect?userId="+encodeURIComponent(userId)),{method:"GET"});
      return response.status===101?response:new Response("Realtime connection failed",{status:502,headers:cors(origin)});
    }
    const prepared=await ensureDeviceIdentity(request);
    const mutation=["POST","PUT","PATCH","DELETE"].includes(request.method)&&url.pathname.startsWith("/api/");
    const response=await app.fetch(prepared.request,env,ctx);
    if(mutation&&response.ok)ctx.waitUntil(broadcast(env,{type:"cloud-data-changed",timestamp:new Date().toISOString(),path:url.pathname,method:request.method}));
    return addDeviceCookie(response,prepared.deviceId,prepared.setCookie,origin);
  } catch(error) { return errorResponse(error,origin); }
} };
