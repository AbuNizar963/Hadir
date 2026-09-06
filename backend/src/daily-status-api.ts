type Env = { DB: D1Database; APP_ORIGIN?: string };

const TZ = "Asia/Damascus";
const DAY_MS = 86_400_000;
type Status = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "PERMISSION" | "NOT_STARTED" | "INVALID";
type EmployeeRow = { id:string; name:string; jobNumber:string; status:string; scheduleType:string; workStartTime:string|null; workEndTime:string|null; workDaysJson:string|null; rotationStartDate:string|null; rotationDaysOn:number|null; rotationDaysOff:number|null; gracePeriodMinutes:number|null; isVip:number|null };
type DailyStatusStoredRow = { employeeId:string; status:string; checkInAt:string|null; checkOutAt:string|null; scheduleType:string };
const CORS_HEADERS={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, content-type","access-control-allow-methods":"GET, OPTIONS","cache-control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...CORS_HEADERS}});
function tzParts(date:Date){const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);const get=(t:string)=>p.find(x=>x.type===t)?.value||"";return{year:Number(get("year")),month:Number(get("month")),day:Number(get("day")),hour:Number(get("hour")),minute:Number(get("minute"))};}
const dayKey=(date:Date)=>{const p=tzParts(date);return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;};
const dayNumber=(day:string)=>Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7))-1,Number(day.slice(8,10)))/DAY_MS;
const addDays=(day:string,n:number)=>new Date((dayNumber(day)+n)*DAY_MS).toISOString().slice(0,10);
function parseTime(value:string|null|undefined,fallback:string){const f=/^(\d{1,2}):(\d{2})/.exec(fallback);const m=/^(\d{1,2}):(\d{2})/.exec(String(value||""));const h=Number(m?.[1]??f?.[1]??9),min=Number(m?.[2]??f?.[2]??0);return{h:Number.isFinite(h)?Math.min(23,Math.max(0,h)):9,m:Number.isFinite(min)?Math.min(59,Math.max(0,min)):0};}
function damascusOffsetMinutes(day:string){const noon=new Date(`${day}T12:00:00Z`);const p=tzParts(noon);return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-noon.getTime())/60000);}
function localDateTimeUtc(day:string,time:string|null|undefined){const t=parseTime(time,"09:00");return new Date(Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7))-1,Number(day.slice(8,10)),t.h,t.m)-damascusOffsetMinutes(day)*60000);}
function workDays(employee:EmployeeRow){try{const parsed=JSON.parse(employee.workDaysJson||"[]");if(Array.isArray(parsed)){const values=[...new Set(parsed.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=6).map(Number))];if(values.length)return values;}}catch{}return[0,1,2,3,4];}
function rotationParams(employee:EmployeeRow){const startDay=String(employee.rotationStartDate||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(startDay))return null;const firstStart=localDateTimeUtc(startDay,employee.workStartTime||"09:00");const on=Math.max(1,Math.floor(Number(employee.rotationDaysOn??4))),off=Math.max(0,Math.floor(Number(employee.rotationDaysOff??4))),cycle=on+off;if(cycle<=0)return null;return{firstStart,on,cycle,cycleMs:cycle*DAY_MS,workMs:on*DAY_MS};}
function rotationScheduleAt(employee:EmployeeRow,instant:Date){const p=rotationParams(employee);if(!p)return{work:false,status:"INVALID" as const,start:null,end:null};const elapsed=instant.getTime()-p.firstStart.getTime();if(elapsed<0)return{work:false,status:"NOT_STARTED" as const,start:null,end:null};const cycleIndex=Math.floor(elapsed/p.cycleMs),within=elapsed-cycleIndex*p.cycleMs,periodStart=new Date(p.firstStart.getTime()+cycleIndex*p.cycleMs),periodEnd=new Date(periodStart.getTime()+p.workMs);if(within>=p.workMs)return{work:false,status:"REST" as const,start:periodStart,end:periodEnd};return{work:true,status:"WORK" as const,start:periodStart,end:periodEnd};}
function scheduleFor(employee:EmployeeRow,day:string){const kind=String(employee.scheduleType||"ADMIN").trim().toUpperCase();if(kind!=="ROTATION"){const weekday=new Date(dayNumber(day)*DAY_MS).getUTCDay();if(!workDays(employee).includes(weekday))return{work:false,status:"REST" as const,start:null,end:null};const start=localDateTimeUtc(day,employee.workStartTime||"09:00");const rawEnd=localDateTimeUtc(day,employee.workEndTime||"16:00");const end=rawEnd.getTime()<=start.getTime()?new Date(rawEnd.getTime()+DAY_MS):rawEnd;return{work:true,status:"WORK" as const,start,end};}
  const p=rotationParams(employee);if(!p)return{work:false,status:"INVALID" as const,start:null,end:null};
  // A rotation report date represents the rotation period that starts on that
  // calendar date at the employee's shift start time, not midnight-to-midnight.
  const dayAnchor=localDateTimeUtc(day,employee.workStartTime||"09:00");
  return rotationScheduleAt(employee,dayAnchor);
}

export async function handleDailyStatus(req:Request,env:Env,actor:any){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS_HEADERS});
  if(req.method!=="GET")return json({error:"الطريقة غير مدعومة"},405);
  if(!actor||!["owner","manager","supervisor"].includes(String(actor.role)))return json({error:"غير مصرح"},403);
  const url=new URL(req.url),requestedDay=String(url.searchParams.get("date")||"").trim(),day=/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)?requestedDay:dayKey(new Date()),nextDay=addDays(day,1),from=localDateTimeUtc(addDays(day,-8),"00:00").toISOString(),to=localDateTimeUtc(addDays(day,9),"00:00").toISOString();
  try{
    const employeeQuery=await env.DB.prepare("SELECT e.id,e.name,e.job_number AS jobNumber,e.status,e.schedule_type AS scheduleType,e.work_start_time AS workStartTime,e.work_end_time AS workEndTime,e.work_days_json AS workDaysJson,e.rotation_start_date AS rotationStartDate,e.rotation_days_on AS rotationDaysOn,e.rotation_days_off AS rotationDaysOff,e.grace_period_minutes AS gracePeriodMinutes,e.isVip AS isVip FROM employees e WHERE e.status='active' OR EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.timestamp>=? AND a.timestamp<?) ORDER BY e.name").bind(localDateTimeUtc(day,"00:00").toISOString(),localDateTimeUtc(nextDay,"00:00").toISOString()).all<EmployeeRow>();
    const attendanceQuery=await env.DB.prepare("SELECT id,employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(from,to).all<any>();
    const requestQuery=await env.DB.prepare("SELECT employee_id AS employeeId,type,status,start_date AS startDate,end_date AS endDate,created_at AS createdAt FROM requests WHERE status IN ('approved','confirmed') AND type IN ('leave','permission')").all<any>();
    const employees=employeeQuery.results||[], attendance=attendanceQuery.results||[], requests=requestQuery.results||[];
    const byEmployee=new Map<string,any[]>();for(const row of attendance){const id=String(row.employeeId||"");if(id){const list=byEmployee.get(id)||[];list.push(row);byEmployee.set(id,list);}}
    const requestActive=(r:any)=>{const start=String(r.startDate||r.createdAt||"").slice(0,10);const end=String(r.endDate||r.startDate||r.createdAt||"").slice(0,10);return start<=day&&day<=end;};
    const leaveIds=new Set(requests.filter((r:any)=>String(r.type).toLowerCase()==="leave"&&requestActive(r)).map((r:any)=>String(r.employeeId)));
    const permissionIds=new Set(requests.filter((r:any)=>String(r.type).toLowerCase()==="permission"&&requestActive(r)).map((r:any)=>String(r.employeeId)));
    const historicalFrom=localDateTimeUtc(addDays(day,-7),"00:00").toISOString();
    const historical=await env.DB.prepare("SELECT employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(historicalFrom,to).all<any>();
    const historicalByEmployee=new Map<string,any[]>();for(const row of historical.results||[]){const id=String(row.employeeId||"");if(id){const list=historicalByEmployee.get(id)||[];list.push(row);historicalByEmployee.set(id,list);}}
    const now=new Date(),today=dayKey(now),dayStartUtc=localDateTimeUtc(day,"00:00"),dayEndUtc=localDateTimeUtc(nextDay,"00:00");
    const result=employees.map(employee=>{
      const id=String(employee.id),isRotation=String(employee.scheduleType||"").trim().toUpperCase()==="ROTATION";let schedule=isRotation&&day===today?rotationScheduleAt(employee,now):scheduleFor(employee,day);const rows=byEmployee.get(id)||[];let checkIn=null;let checkOut=null;
      if(isRotation){
        const periodStart=schedule.start;
        const periodEnd=schedule.end;
        if(schedule.work&&periodStart&&periodEnd){
          const periodEvents=(historicalByEmployee.get(id)||[]).filter((r:any)=>{const ts=Date.parse(String(r.timestamp));return Number.isFinite(ts)&&ts>=periodStart.getTime()&&ts<periodEnd.getTime()&&(! (day===today) || ts<=now.getTime());});
          checkIn=periodEvents.find((r:any)=>String(r.type)==="check-in")||null;
          checkOut=[...periodEvents].reverse().find((r:any)=>String(r.type)==="check-out")||null;
        }
      } else {
        // ADMIN attendance belongs to the requested local calendar day. The
        // broader query above is retained for employee discovery/history, but
        // must never leak yesterday's or future events into today's status.
        const dayEvents=rows.filter((r:any)=>{const ts=Date.parse(String(r.timestamp));return Number.isFinite(ts)&&ts>=dayStartUtc.getTime()&&ts<dayEndUtc.getTime()&&(!(day===today)||ts<=now.getTime());});
        checkIn=dayEvents.find((r:any)=>String(r.type)==="check-in")||null;
        checkOut=[...dayEvents].reverse().find((r:any)=>String(r.type)==="check-out")||null;
      }
      let status:Status;if(leaveIds.has(id))status="LEAVE";else if(permissionIds.has(id))status="PERMISSION";else if(schedule.status==="REST")status="REST";else if(schedule.status==="NOT_STARTED")status="NOT_STARTED";else if(schedule.status==="INVALID")status="INVALID";else if(checkIn){const grace=Number.isFinite(Number(employee.gracePeriodMinutes))?Math.max(0,Number(employee.gracePeriodMinutes)):10;status=isRotation?"PRESENT":(schedule.start&&Date.parse(String(checkIn.timestamp))>schedule.start.getTime()+grace*60000?"LATE":"PRESENT");}else if(Number(employee.isVip)===1&&schedule.start&&day===today&&now.getTime()>=schedule.start.getTime())status="PRESENT";else if(day===today&&schedule.end&&now.getTime()>=schedule.end.getTime())status="REST";else if(day===today&&schedule.start&&now.getTime()<schedule.start.getTime())status="NOT_STARTED";else if(!schedule.work)status="REST";else status="ABSENT";
      return{attendanceDay:day,employeeId:id,employeeName:String(employee.name||""),jobNumber:String(employee.jobNumber||""),status,scheduleType:String(employee.scheduleType||"ADMIN").toUpperCase(),checkInAt:checkIn?.timestamp||null,checkOutAt:checkOut?.timestamp||null,scheduledStart:schedule.start?.toISOString()||null,scheduledEnd:schedule.end?.toISOString()||null};
    });
    const computedAt=new Date().toISOString();
    if(result.length){
      const storedQuery=await env.DB.prepare("SELECT employee_id AS employeeId,status,check_in_at AS checkInAt,check_out_at AS checkOutAt,schedule_type AS scheduleType FROM daily_attendance_status WHERE attendance_day=?").bind(day).all<DailyStatusStoredRow>();
      const stored=new Map((storedQuery.results||[]).map(row=>[String(row.employeeId),row]));
      const changed=result.filter(row=>{const previous=stored.get(row.employeeId);return !previous||String(previous.status||"")!==row.status||String(previous.checkInAt||"")!==String(row.checkInAt||"")||String(previous.checkOutAt||"")!==String(row.checkOutAt||"")||String(previous.scheduleType||"")!==row.scheduleType;});
      if(changed.length)await env.DB.batch(changed.map(row=>env.DB.prepare("INSERT INTO daily_attendance_status(attendance_day,employee_id,status,check_in_at,check_out_at,schedule_type,computed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(attendance_day,employee_id) DO UPDATE SET status=excluded.status,check_in_at=excluded.check_in_at,check_out_at=excluded.check_out_at,schedule_type=excluded.schedule_type,computed_at=excluded.computed_at").bind(row.attendanceDay,row.employeeId,row.status,row.checkInAt,row.checkOutAt,row.scheduleType,computedAt)));
    }
    const counts=result.reduce<Record<string,number>>((acc,row)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{});
    return json({attendanceDay:day,timezone:TZ,computedAt,total:result.length,counts,employees:result});
  }catch(error){console.error("daily-status failed",error);return json({error:"تعذر قراءة حالة الدوام من D1"},500);}
}
