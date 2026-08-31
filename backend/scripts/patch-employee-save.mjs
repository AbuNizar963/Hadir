import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/index.ts", import.meta.url);
let source = readFileSync(file, "utf8");

function replaceOnce(anchor, replacement, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw new Error(`Employee save patch: expected exactly one ${label} anchor, found ${count}.`);
  source = source.replace(anchor, replacement);
}

replaceOnce(
  "work_end_time TEXT,grace_period_minutes INTEGER NOT NULL DEFAULT 10,role TEXT NOT NULL DEFAULT 'staff'",
  "work_end_time TEXT,early_checkout_grace_minutes INTEGER,grace_period_minutes INTEGER NOT NULL DEFAULT 10,role TEXT NOT NULL DEFAULT 'staff'",
  "employee schema anchor",
);

replaceOnce(
  "gracePeriodMinutes:r.grace_period_minutes,role:r.role",
  "gracePeriodMinutes:r.grace_period_minutes,earlyCheckoutGraceMinutes:r.early_checkout_grace_minutes,role:r.role",
  "employee output anchor",
);

replaceOnce(
  "gracePeriodMinutes:\"grace_period_minutes\",role:\"role\"",
  "gracePeriodMinutes:\"grace_period_minutes\",earlyCheckoutGraceMinutes:\"early_checkout_grace_minutes\",role:\"role\"",
  "employee update mapping anchor",
);

replaceOnce(
  "if(!sets.length)return json({ok:true,employee:employeeOut(current)},200,origin);",
  "if(!sets.length)return json({error:\"لم تصل أي حقول قابلة للحفظ إلى خادم D1. لم يتم اعتبار العملية ناجحة.\"},400,origin);",
  "false-success guard",
);

replaceOnce(
  "if(b.specialties!==undefined){sets.push(\"specialties_json=?\");values.push(JSON.stringify(b.specialties));}",
  "if(b.specialties!==undefined){const specialties=Array.isArray(b.specialties)?b.specialties.map((item:any)=>String(item).trim()).filter(Boolean):String(b.specialties||\"\").split(\",\").map((item)=>item.trim()).filter(Boolean);sets.push(\"specialties_json=?\");values.push(JSON.stringify(specialties));}",
  "specialties normalization anchor",
);

replaceOnce(
  "if(b.workDays!==undefined){sets.push(\"work_days_json=?\");values.push(JSON.stringify(b.workDays));}",
  "if(b.workDays!==undefined){const workDays=Array.isArray(b.workDays)?b.workDays.map((item:any)=>Number(item)).filter((item)=>Number.isInteger(item)&&item>=0&&item<=6):[];sets.push(\"work_days_json=?\");values.push(JSON.stringify(workDays));}",
  "work-days normalization anchor",
);

replaceOnce(
  'const id=decodeURIComponent(path.split("/").pop()||""),b=await body(req),sets:string[]=[],values:any[]=[];const current=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();if(!current)return json({error:"الموظف غير موجود"},404,origin);',
  'const id=decodeURIComponent(path.split("/").pop()||""),b=await body(req),sets:string[]=[],values:any[]=[];const current=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();if(!current)return json({error:"الموظف غير موجود"},404,origin);const previousScheduleType=String(current.schedule_type||"ADMIN").toUpperCase();',
  "schedule transition anchor",
);

replaceOnce(
  'for(const[k,col]of Object.entries({name:"name",status:"status",scheduleType:"schedule_type",rotationStartDate:"rotation_start_date",workStartTime:"work_start_time",workEndTime:"work_end_time",gracePeriodMinutes:"grace_period_minutes",earlyCheckoutGraceMinutes:"early_checkout_grace_minutes",role:"role",locationId:"location_id",rotationDaysOn:"rotation_days_on",rotationDaysOff:"rotation_days_off",avatar:"avatar"}))if(b[k]!==undefined){sets.push(`${col}=?`);values.push(b[k]);}',
  'for(const[k,col]of Object.entries({name:"name",status:"status",scheduleType:"schedule_type",rotationStartDate:"rotation_start_date",workStartTime:"work_start_time",workEndTime:"work_end_time",gracePeriodMinutes:"grace_period_minutes",earlyCheckoutGraceMinutes:"early_checkout_grace_minutes",role:"role",locationId:"location_id",rotationDaysOn:"rotation_days_on",rotationDaysOff:"rotation_days_off",avatar:"avatar"}))if(b[k]!==undefined){sets.push(`${col}=?`);values.push(b[k]);}if(String(b.scheduleType||"").toUpperCase()==="ADMIN"&&previousScheduleType==="ROTATION"){sets.push("work_start_time=?","work_end_time=?","work_days_json=?","rotation_start_date=?","rotation_days_on=?","rotation_days_off=?");values.push("08:00","16:00",JSON.stringify([0,1,2,3,4]),null,null,null);}',
  "administrative default schedule",
);

replaceOnce(
  'const employee=await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first<any>();if(jobNumberChanged)await audit(env,req,actor.name,"employee-job-number-update","success",id,String(employee?.job_number||""),`تغيير الرقم الوظيفي من ${previousJobNumber} إلى ${String(employee?.job_number||"")}`);return json({ok:true,employee:employeeOut(employee),...(jobNumberChanged?{previousJobNumber}: {})},200,origin);',
  'const employee=await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first<any>();if(!employee)return json({error:"تعذر قراءة بيانات الموظف بعد الحفظ"},500,origin);const verifyPairs:Array<[string,unknown]>=[];const map:[[string,string]]=[];const add=(key:string,col:string)=>{if(b[key]!==undefined)verifyPairs.push([col,b[key]]);};add("name","name");add("jobNumber","job_number");add("status","status");add("scheduleType","schedule_type");add("rotationStartDate","rotation_start_date");add("workStartTime","work_start_time");add("workEndTime","work_end_time");add("gracePeriodMinutes","grace_period_minutes");add("earlyCheckoutGrace","early_checkout_grace_minutes");add("locationId","location_id");add("rotationDaysOn","rotation_days_on");add("rotationDaysOff","rotation_days_off");for(const [col,expected] of verifyPairs){const normalizedExpected=expected==null?null:String(expected);const actual=employee[col]==null?null:String(employee[col]);if(normalizedExpected!==actual)return json({error:"الخادم لم يؤكد حفظ جميع تعديلات الموظف في D1",field:col},500,origin);}if(b.scheduleType!==undefined&&String(b.scheduleType).toUpperCase()==="ADMIN"&&previousScheduleType==="ROTATION"){if(String(employee.work_start_time||"")!=="08:00"||String(employee.work_end_time||"")!=="16:00"||String(employee.work_days_json||"[]")!==JSON.stringify([0,1,2,3,4])||employee.rotation_start_date!=null||employee.rotation_days_on!=null||employee.rotation_days_off!=null)return json({error:"تعذر تطبيق جدول الإداري الافتراضي في D1"},500,origin);}if(b.specialties!==undefined){const expected=JSON.stringify(Array.isArray(b.specialties)?b.specialties.map((item:any)=>String(item).trim()).filter(Boolean):String(b.specialties||"").split(",").map((item)=>item.trim()).filter(Boolean));if(String(employee.specialties_json||"[]")!==expected)return json({error:"الخادم لم يؤكد حفظ تخصصات الموظف في D1"},500,origin);}if(b.workDays!==undefined&&!(b.scheduleType!==undefined&&String(b.scheduleType).toUpperCase()==="ADMIN"&&previousScheduleType==="ROTATION")){const expected=JSON.stringify(Array.isArray(b.workDays)?b.workDays.map((item:any)=>Number(item)).filter((item)=>Number.isInteger(item)&&item>=0&&item<=6):[]);if(String(employee.work_days_json||"[]")!==expected)return json({error:"الخادم لم يؤكد حفظ أيام دوام الموظف في D1"},500,origin);}if(jobNumberChanged)await audit(env,req,actor.name,"employee-job-number-update","success",id,String(employee?.job_number||""),`تغيير الرقم الوظيفي من ${previousJobNumber} إلى ${String(employee?.job_number||"")}`);return json({ok:true,employee:employeeOut(employee),...(jobNumberChanged?{previousJobNumber}: {})},200,origin);',
  "post-update D1 verification",
);

writeFileSync(file, source, "utf8");
console.log("Employee save D1 patch applied.");
