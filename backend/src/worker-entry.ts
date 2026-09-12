import base from "./attendance-safety-gateway";
import { HadirRealtime } from "./realtime";
import { archiveClosedMonth, deleteReportArchive, getReportArchive, listReportArchives } from "./report-archive";
export { HadirRealtime };

type Env = { DB: D1Database; REPORT_ARCHIVES?: R2Bucket; APP_TIMEZONE?: string; APP_ORIGIN?: string };
const SESSION_COOKIE = "hadir_session";
function readCookie(request:Request,name:string){const cookies=request.headers.get("cookie")||"";const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));return item?decodeURIComponent(item.slice(name.length+1)):"";}
async function hashToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));let binary="";for(const byte of new Uint8Array(digest))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function archiveActor(request:Request,env:Env){const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim();if(!token)return null;try{const h=await hashToken(token);const s=await env.DB.prepare("SELECT user_id AS userId,user_type AS userType FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(h).first<any>();if(!s||s.userType!=="admin")return null;return await env.DB.prepare("SELECT id,name,role FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(s.userId).first<any>();}catch{return null;}}
function cors(request:Request,env:Env){return String(env.APP_ORIGIN||request.headers.get("origin")||"*").split(",")[0].trim()||"*";}
function json(data:unknown,status:number,o:string){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":o,"access-control-allow-credentials":"true","cache-control":"no-store"}});}
function archiveAllowed(a:any){return !!a&&["owner","manager","supervisor"].includes(String(a.role).toLowerCase());}
function archiveDeleteAllowed(a:any){return !!a&&String(a.role).toLowerCase()==="owner";}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext){
    const url=new URL(request.url), path=url.pathname, o=cors(request,env);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":o,"access-control-allow-credentials":"true","access-control-allow-methods":"GET,DELETE,OPTIONS","access-control-allow-headers":"authorization,content-type","cache-control":"no-store"}});
    if(path==="/api/reports/archive"&&request.method==="GET"){
      const a=await archiveActor(request,env); if(!archiveAllowed(a))return json({error:"غير مصرح"},403,o);
      const limit=Number(url.searchParams.get("limit")||25); return json({ok:true,readOnly:true,archives:await listReportArchives(env,limit)},200,o);
    }
    const match=path.match(/^\/api\/reports\/archive\/([^/]+)$/);
    if(match&&(request.method==="GET"||request.method==="DELETE")){
      const a=await archiveActor(request,env); if(!archiveAllowed(a))return json({error:"غير مصرح"},403,o);
      const id=decodeURIComponent(match[1]);
      if(request.method==="DELETE"){
        if(!archiveDeleteAllowed(a))return json({error:"حذف أرشيف التقارير متاح للمالك فقط"},403,o);
        if(!env.REPORT_ARCHIVES)return json({error:"R2 binding REPORT_ARCHIVES غير موجود"},503,o);
        try{const result=await deleteReportArchive(env,id);if(!result.ok)return json({error:"الأرشيف غير موجود أو تم حذفه مسبقًا"},404,o);return json({ok:true,deleted:true,reportId:id},200,o);}catch(error){console.error("[report-archive] delete failed",error);return json({error:error instanceof Error?error.message:"تعذر حذف الأرشيف"},500,o);}
      }
      if(!env.REPORT_ARCHIVES)return json({error:"R2 binding REPORT_ARCHIVES غير موجود"},503,o);
      const meta=await getReportArchive(env,id); if(!meta)return json({error:"الأرشيف غير موجود"},404,o);
      const object=await env.REPORT_ARCHIVES.get(meta.file_key); if(!object)return json({error:"ملف الأرشيف غير موجود في R2"},404,o);
      return new Response(object.body,{status:200,headers:{"content-type":meta.mime_type,"content-length":String(meta.file_size),"content-disposition":`attachment; filename="${meta.file_name.replace(/[^A-Za-z0-9._-]/g,"_")}"`,"cache-control":"private, max-age=300","access-control-allow-origin":o,"access-control-allow-credentials":"true"}});
    }
    return base.fetch(request,env,ctx);
  },
  async scheduled(controller:ScheduledController,env:Env,ctx:ExecutionContext){
    if(typeof (base as any).scheduled==="function")await (base as any).scheduled(controller,env,ctx);
    try{console.log("[report-archive]",JSON.stringify(await archiveClosedMonth(env)));}catch(error){console.error("[report-archive] monthly archive failed",error);}
  },
};
