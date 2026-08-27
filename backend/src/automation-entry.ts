import base, { HadirRealtime } from "./ai-entry";
import { directAttendance, workforceControls, runAutomaticAttendance } from "./automaticAttendance";

type Env = {
  DB: D1Database;
  REALTIME: DurableObjectNamespace;
  APP_ORIGIN?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<any> };
};

const SESSION_COOKIE = "hadir_session";
function readCookie(request: Request, name: string) { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return item?decodeURIComponent(item.slice(name.length+1)):""; }
async function hashToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));let binary="";for(const byte of new Uint8Array(digest))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function actor(request:Request,env:Env){const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim();if(!token)return null;try{const h=await hashToken(token);const s=await env.DB.prepare("SELECT user_id AS userId,user_type AS userType FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(h).first<any>();if(!s||s.userType!=="admin")return null;return await env.DB.prepare("SELECT id,name,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(s.userId).first<any>();}catch{return null;}}
function origin(request:Request,env:Env){return String(env.APP_ORIGIN||request.headers.get("origin")||"*").split(",")[0].trim().replace(/\/$/,"")||"*";}

export { base, HadirRealtime };
export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext){
    const a=await actor(request,env);const o=origin(request,env);const path=new URL(request.url).pathname;
    if(path==="/api/workforce/live"&&request.method==="PATCH"){
      const b=await request.clone().json().catch(()=>({})) as any;const employeeId=String(b.employeeId||"").trim();
      if(!employeeId)return new Response(JSON.stringify({error:"الموظف مطلوب"}),{status:400,headers:{"content-type":"application/json","access-control-allow-origin":o,"access-control-allow-credentials":"true"}});
      const u=new URL(request.url);u.pathname=`/api/manager/workforce-controls/${encodeURIComponent(employeeId)}`;
      const controls=await workforceControls(new Request(u,request),env,a,o);if(controls)return controls;
    }
    if(path==="/api/workforce/live"&&request.method==="GET"){
      const u=new URL(request.url);u.pathname="/api/manager/workforce-controls";
      const controls=await workforceControls(new Request(u,request),env,a,o);if(controls)return controls;
    }
    if(path==="/api/workforce/live"&&request.method==="POST"){
      const b=await request.clone().json().catch(()=>({})) as any;const type=String(b.type||"");const u=new URL(request.url);
      u.pathname=type==="check-out"?"/api/manager/attendance/checkout":type==="check-in"?"/api/manager/attendance/check-in":"/api/manager/attendance";
      const direct=await directAttendance(new Request(u,request),env,a,o);if(direct)return direct;
    }
    const direct=await directAttendance(request,env,a,o);if(direct)return direct;
    const controls=await workforceControls(request,env,a,o);if(controls)return controls;
    return base.fetch(request,env,ctx);
  },
  async scheduled(controller:ScheduledController,env:Env){
    if(typeof base.scheduled==="function")await base.scheduled(controller,env);
    await runAutomaticAttendance(env);
  },
};