import { refreshProfessionalAttendanceFact } from "./professional-attendance-fact-builder";
import { refreshCanonicalStatus } from "./attendance-engine-commands";
import { dateKeyLocal, insertAutomaticAttendance, operationalShift, runAutomaticAttendance } from "./attendance-engine-automatic-commands";

export { runAutomaticAttendance } from "./attendance-engine-automatic-commands";

type Env={DB:D1Database; APP_TIMEZONE?:string};
type Admin={id:string;name?:string;role:string};
const json=(data:unknown,status=200,origin="*")=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":origin,"access-control-allow-credentials":"true","cache-control":"no-store"}});
const OWNER="المالك فقط يستطيع تنفيذ التحضير أو الانصراف المباشر أو تعديل التلقائي";
function roleIsOwner(actor:Admin|null){return !!actor&&String(actor.role).toLowerCase()==="owner";}

export async function directAttendance(req:Request,env:Env,actor:Admin|null,origin:string){
  const path=new URL(req.url).pathname;
  if(!["/api/manager/attendance/checkout","/api/manager/attendance/check-in","/api/manager/attendance"].includes(path)||req.method!=="POST")return null;
  if(!actor||!["owner","manager"].includes(String(actor.role).toLowerCase()))return json({error:OWNER},403,origin);
  const b=await req.json().catch(()=>({})) as any;
  const employeeId=String(b.employeeId||"").trim();
  if(!employeeId)return json({error:"الموظف مطلوب"},400,origin);
  const employee=await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if(!employee||employee.status!=="active")return json({error:"الموظف غير موجود أو موقوف"},404,origin);
  const type=path.endsWith("checkout")?"check-out":path.endsWith("check-in")?"check-in":b.type==="check-out"?"check-out":"check-in";
  const current=new Date();
  const tz=env.APP_TIMEZONE||"Asia/Damascus";
  const shift=operationalShift(employee,current,tz);
  if(!shift.isWorkDay)return json({error:"لا يوجد دوام للموظف الآن"},403,origin);
  const rows=await env.DB.prepare("SELECT type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<=? ORDER BY timestamp ASC").bind(employeeId,shift.start.toISOString(),new Date(Math.min(shift.end.getTime()+60000,current.getTime())).toISOString()).all<any>();
  const periodRows=(rows.results||[]) as any[];
  const last=periodRows[periodRows.length-1];
  if(type==="check-in"&&periodRows.some((r:any)=>r.type==="check-in"))return json({error:"الموظف مسجل حضور بالفعل لهذه المناوبة"},409,origin);
  if(type==="check-out"&&last?.type!=="check-in")return json({error:"لا يمكن تسجيل الانصراف قبل تسجيل الحضور لهذه المناوبة"},409,origin);
  if(type==="check-out"&&current.getTime()<shift.end.getTime())return json({error:"لم ينتهِ وقت دوام الموظف بعد"},403,origin);
  const record=await insertAutomaticAttendance(env.DB,employee,type,current.toISOString(),actor?.name||(String(actor.role).toLowerCase()==="manager"?"المدير":"المالك"),type==="check-in"?"تحضير مباشر لمهمة/مأمورية":"انصراف مباشر لمهمة/مأمورية");
  if(!record)return json({error:"لا يوجد موقع عمل محفوظ"},409,origin);
  await refreshCanonicalStatus(env,{id:employee.id,role:"staff"},current);
  await refreshProfessionalAttendanceFact(env,dateKeyLocal(current,tz),{id:employee.id,role:"staff"},employee.id);
  return json({ok:true,record},201,origin);
}

export async function workforceControls(req:Request,env:Env,actor:Admin|null,origin:string){
  const u=new URL(req.url);
  if(!u.pathname.startsWith("/api/manager/workforce-controls"))return null;
  if(!actor||!["owner","manager","supervisor"].includes(String(actor.role).toLowerCase()))return json({error:"غير مصرح"},403,origin);
  if(req.method==="GET"){
    const rows=await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees ORDER BY name").all<any>();
    return json((rows.results||[]).map((e:any)=>({...e,isVip:Boolean(e.isVip),autoCheckIn:Boolean(e.autoCheckIn),autoCheckOut:Boolean(e.autoCheckOut),workDays:(()=>{try{return JSON.parse(e.workDaysJson||"[]")}catch{return[]}})()})),200,origin);
  }
  const m=u.pathname.match(/^\/api\/manager\/workforce-controls\/([^/]+)$/);
  if(!m||req.method!=="PATCH")return json({error:"WORKFORCE_CONTROL_ROUTE_NOT_FOUND"},404,origin);
  if(!roleIsOwner(actor))return json({error:OWNER},403,origin);
  const employeeId=decodeURIComponent(m[1]);
  const e=await env.DB.prepare("SELECT id FROM employees WHERE id=? LIMIT 1").bind(employeeId).first();
  if(!e)return json({error:"EMPLOYEE_NOT_FOUND"},404,origin);
  const b=await req.json().catch(()=>({})) as any;
  const fields:string[]=[];const values:any[]=[];
  const vip=typeof b.isVip==="boolean"?b.isVip:null;
  const hasAutoCheckIn=typeof b.autoCheckIn==="boolean";const hasAutoCheckOut=typeof b.autoCheckOut==="boolean";
  if(vip!==null){fields.push("is_vip=?","auto_check_in=?","auto_check_out=?");values.push(vip?1:0,vip?1:0,vip?1:0);}else{if(hasAutoCheckIn){fields.push("auto_check_in=?");values.push(b.autoCheckIn?1:0);}if(hasAutoCheckOut){fields.push("auto_check_out=?");values.push(b.autoCheckOut?1:0);}}
  if(!fields.length)return json({error:"لا توجد تغييرات"},400,origin);
  values.push(employeeId);
  await env.DB.prepare(`UPDATE employees SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
  return json({ok:true,employeeId},200,origin);
}

void runAutomaticAttendance;
