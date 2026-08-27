import base, { HadirRealtime } from "./ai-entry";
import { directAttendance, workforceControls, runAutomaticAttendance } from "./automaticAttendance";
import { resetTestData } from "./test-data-reset";
import { handleProfileImageRequest } from "./r2";
import { clearEmployeeDevice } from "./deviceSecurity";

type Env = { DB: D1Database; REALTIME: DurableObjectNamespace; APP_ORIGIN?: string; APP_TIMEZONE?: string; JWT_SECRET?: string; OWNER_RECOVERY_CODE?: string; PROFILE_IMAGES?: R2Bucket; AI?: { run(model: string, input: Record<string, unknown>): Promise<any> } };
type ProfileActor = { id: string; username?: string; name: string; role: "owner" | "manager" | "supervisor" | "staff" };
const SESSION_COOKIE = "hadir_session";
function readCookie(request: Request, name: string) { const cookies=request.headers.get("cookie")||""; const item=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return item?decodeURIComponent(item.slice(name.length+1)):""; }
async function hashToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));let binary="";for(const byte of new Uint8Array(digest))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
const PASSWORD_ITERATIONS=100000;
function b64(data:ArrayBuffer|Uint8Array){const bytes=data instanceof Uint8Array?data:new Uint8Array(data);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function hashPassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:PASSWORD_ITERATIONS,hash:"SHA-256"},key,256);return `pbkdf2$${PASSWORD_ITERATIONS}$${b64(salt)}$${b64(bits)}`;}
async function actor(request:Request,env:Env){const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim();if(!token)return null;try{const h=await hashToken(token);const s=await env.DB.prepare("SELECT user_id AS userId,user_type AS userType FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(h).first<any>();if(!s||s.userType!=="admin")return null;return await env.DB.prepare("SELECT id,name,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(s.userId).first<any>();}catch{return null;}}
async function profileImageActor(request:Request,env:Env):Promise<ProfileActor|null>{const token=(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"").trim();if(!token)return null;try{const h=await hashToken(token);const s=await env.DB.prepare("SELECT user_id AS userId,user_type AS userType,role FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(h).first<any>();if(!s)return null;if(s.userType==="admin"){const row=await env.DB.prepare("SELECT id,username,name,role,active FROM admin_accounts WHERE id=? AND active=1 LIMIT 1").bind(s.userId).first<any>();return row?{id:row.id,username:row.username,name:row.name,role:row.role}:null;}const row=await env.DB.prepare("SELECT id,job_number AS username,name,status FROM employees WHERE id=? LIMIT 1").bind(s.userId).first<any>();return row&&row.status==="active"?{id:row.id,username:row.username,name:row.name,role:"staff"}:null;}catch{return null;}}
function origin(request:Request,env:Env){return String(env.APP_ORIGIN||request.headers.get("origin")||"*").split(",")[0].trim().replace(/\/$/,"")||"*";}
function preflight(originValue:string){return new Response(null,{status:204,headers:{"access-control-allow-origin":originValue,"access-control-allow-credentials":"true","access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS","access-control-allow-headers":"authorization,content-type,x-requested-with,x-device-id","access-control-max-age":"86400","cache-control":"no-store"}});}
function json(data:unknown,status:number,originValue:string){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":originValue,"access-control-allow-credentials":"true","cache-control":"no-store"}});}

export { base, HadirRealtime };
export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext){
    const o=origin(request,env);
    if(request.method==="OPTIONS")return preflight(o);
    const path=new URL(request.url).pathname;
    if(path.match(/^\/api\/employees\/[^/]+\/avatar$/)){
      const imageActor=await profileImageActor(request,env);
      const imageResponse=await handleProfileImageRequest(request,env,imageActor,o);
      if(imageResponse)return imageResponse;
    }
    const a=await actor(request,env);

    if(path==="/api/owner/bulk-settings"&&request.method==="POST"){
      if(!a||String(a.role).toLowerCase()!=="owner")return json({error:"المالك فقط يستطيع تنفيذ إعدادات الموظفين الجماعية"},403,o);
      try{
        const contentType=request.headers.get("content-type")||"";
        if(contentType.toLowerCase().includes("multipart/form-data")){
          if(!env.PROFILE_IMAGES)return json({error:"R2 binding PROFILE_IMAGES غير موجود"},503,o);
          const form=await request.formData();
          if(String(form.get("action")||"")!=="avatar")return json({error:"إجراء الصورة غير صحيح"},400,o);
          const file=form.get("file");
          if(!(file instanceof File))return json({error:"IMAGE_FILE_REQUIRED"},400,o);
          if(file.type!=="image/webp")return json({error:"الصورة يجب أن تكون WebP"},415,o);
          if(file.size<=0||file.size>100*1024)return json({error:"حجم الصورة يجب ألا يتجاوز 100 كيلوبايت"},413,o);
          const employees=await env.DB.prepare("SELECT id FROM employees").all<any>();
          let updated=0;
          const bytes=await file.arrayBuffer();
          for(const employee of (employees.results||[]) as any[]){
            const key=`employees/${employee.id}/avatar.webp`;
            await env.PROFILE_IMAGES.put(key,bytes,{httpMetadata:{contentType:"image/webp",cacheControl:"private, max-age=31536000, immutable"},customMetadata:{employeeId:String(employee.id),uploadedBy:String(a.id),bulkUpdate:"true"}});
            await env.DB.prepare("UPDATE employees SET avatar=? WHERE id=?").bind(key,employee.id).run();
            updated++;
          }
          return json({ok:true,updated,message:`تم تحديث صورة ${updated} موظفًا.`},200,o);
        }
        const b=await request.json().catch(()=>({})) as any;
        const action=String(b.action||"");
        if(action==="password"){
          const password=String(b.password||"");
          if(password.length<6)return json({error:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"},400,o);
          const passwordHash=await hashPassword(password);
          const result=await env.DB.prepare("UPDATE employees SET pin_hash=?").bind(passwordHash).run();
          await env.DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_type='employee' AND revoked_at IS NULL").bind(new Date().toISOString()).run().catch(()=>undefined);
          return json({ok:true,updated:Number(result.meta.changes||0),message:"تم تغيير كلمة مرور جميع الموظفين وإعادة تسجيل دخولهم.",action},200,o);
        }
        if(action==="grace"){
          const minutes=Number(b.minutes);
          if(!Number.isInteger(minutes)||minutes<0||minutes>180)return json({error:"مهلة التأخر يجب أن تكون بين 0 و180 دقيقة"},400,o);
          const result=await env.DB.prepare("UPDATE employees SET grace_period_minutes=?").bind(minutes).run();
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES('lateGraceMinutes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(minutes)).run();
          return json({ok:true,updated:Number(result.meta.changes||0),message:`تم ضبط مهلة التأخر لجميع الموظفين إلى ${minutes} دقيقة.`,action},200,o);
        }
        if(action==="earlyCheckout"){
          const minutes=Number(b.minutes);
          if(!Number.isInteger(minutes)||minutes<0||minutes>180)return json({error:"مهلة الانصراف المبكر يجب أن تكون بين 0 و180 دقيقة"},400,o);
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES('earlyCheckoutGraceMinutes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(minutes)).run();
          return json({ok:true,updated:1,message:`تم ضبط مهلة الانصراف المبكر العامة إلى ${minutes} دقيقة.`,action},200,o);
        }
        if(action==="adminWorkHours"||action==="rotationWorkHours"){
          const workStartTime=String(b.workStartTime||"").trim();
          const workEndTime=String(b.workEndTime||"").trim();
          const scheduleType=action==="adminWorkHours"?"ADMIN":"ROTATION";
          if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(workStartTime)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(workEndTime))return json({error:"وقت بداية ونهاية الدوام يجب أن يكونا بصيغة HH:MM صحيحة"},400,o);
          if(workStartTime===workEndTime)return json({error:"وقت بداية ونهاية الدوام يجب أن يكونا مختلفين"},400,o);
          const result=await env.DB.prepare("UPDATE employees SET work_start_time=?,work_end_time=? WHERE schedule_type=?").bind(workStartTime,workEndTime,scheduleType).run();
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(scheduleType==="ADMIN"?"bulkAdminWorkHours":"bulkRotationWorkHours",JSON.stringify({workStartTime,workEndTime})).run();
          return json({ok:true,updated:Number(result.meta.changes||0),message:`تم تحديث أوقات دوام ${scheduleType==="ADMIN"?"الموظفين الإداريين":"الموظفين التناوبيين"} لـ ${Number(result.meta.changes||0)} موظفًا إلى ${workStartTime} → ${workEndTime}.`,action},200,o);
        }
        if(action==="rotationDays"){
          const rotationDaysOn=Number(b.rotationDaysOn);
          const rotationDaysOff=Number(b.rotationDaysOff);
          if(!Number.isInteger(rotationDaysOn)||rotationDaysOn<1||rotationDaysOn>31||!Number.isInteger(rotationDaysOff)||rotationDaysOff<0||rotationDaysOff>31)return json({error:"أيام التناوب يجب أن تكون: المناوبة 1–31 يومًا، والراحة 0–31 يومًا"},400,o);
          if(rotationDaysOn+rotationDaysOff<2)return json({error:"يجب أن تحتوي دورة التناوب على يومين على الأقل"},400,o);
          const result=await env.DB.prepare("UPDATE employees SET rotation_days_on=?,rotation_days_off=? WHERE schedule_type='ROTATION'").bind(rotationDaysOn,rotationDaysOff).run();
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES('bulkRotationDays',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({rotationDaysOn,rotationDaysOff})).run();
          return json({ok:true,updated:Number(result.meta.changes||0),message:`تم تحديث دورة التناوب لـ ${Number(result.meta.changes||0)} موظفًا تناوبيًا إلى ${rotationDaysOn} أيام مناوبة + ${rotationDaysOff} أيام راحة.`,action},200,o);
        }
        if(action==="unlinkDevices"){
          const employees=await env.DB.prepare("SELECT id FROM employees").all<any>();
          let updated=0;
          for(const employee of (employees.results||[]) as any[]){ await clearEmployeeDevice(env,String(employee.id)); updated++; }
          return json({ok:true,updated,message:`تم فك ربط ${updated} جهازًا وحذف مفاتيح الدخول المرتبطة بها.`},200,o);
        }
        if(action==="revokeSessions"){
          const result=await env.DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_type='employee' AND revoked_at IS NULL").bind(new Date().toISOString()).run();
          return json({ok:true,updated:Number(result.meta.changes||0),message:"تم إلغاء جلسات الموظفين الحالية."},200,o);
        }
        return json({error:"إجراء غير مدعوم"},400,o);
      }catch(error){return json({error:error instanceof Error?error.message:"تعذر تنفيذ إعداد الموظفين الجماعي"},500,o);}
    }

    if(path==="/api/workforce/reset-test-data"&&request.method==="POST"){
      if(!a||String(a.role).toLowerCase()!=="owner")return json({error:"المالك فقط يستطيع حذف بيانات الاختبار"},403,o);
      const body=await request.clone().json().catch(()=>({})) as any;
      if(String(body.confirmation||"")!=="حذف البيانات التجريبية")return json({error:"عبارة التأكيد غير صحيحة"},400,o);
      try{
        const result=await resetTestData(env);
        const deletedTables=Object.entries(result.deleted).filter(([,count])=>count>0).map(([table,count])=>`${table}: ${count}`);
        const totalRows=Object.values(result.deleted).reduce((sum,count)=>sum+count,0);
        return json({ok:true,deleted:{...result.deleted,r2ProfileImages:result.r2Deleted,totalRows},preserved:result.preserved,message:`تم حذف ${totalRows} سجلًا من بيانات الاختبار وحذف ${result.r2Deleted} صورة من خادم الصور.${deletedTables.length?` الجداول المنظفة: ${deletedTables.join("، ")}.`:""} بقي حسابات الإدارة والإعدادات ومواقع العمل محفوظة.`},200,o);
      }catch(error){return json({error:error instanceof Error?`فشل تنظيف بيانات الاختبار: ${error.message}`:"فشل تنظيف بيانات الاختبار من الخادم."},500,o);}
    }

    if(path==="/api/workforce/live"&&request.method==="PATCH"){
      const b=await request.clone().json().catch(()=>({})) as any;const employeeId=String(b.employeeId||"").trim();
      if(!employeeId)return json({error:"الموظف مطلوب"},400,o);
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
