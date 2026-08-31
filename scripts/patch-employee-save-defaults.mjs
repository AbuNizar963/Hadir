import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../backend/src/index.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const anchor = 'const id=decodeURIComponent(path.split("/").pop()||""),b=await body(req),sets:string[]=[],values:any[]=[];const current=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();if(!current)return json({error:"الموظف غير موجود"},404,origin);';
const replacement = 'const id=decodeURIComponent(path.split("/").pop()||""),b=await body(req),sets:string[]=[],values:any[]=[];const current=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();if(!current)return json({error:"الموظف غير موجود"},404,origin);const previousScheduleType=String(current.schedule_type||"ADMIN").toUpperCase();';
if (!source.includes(anchor)) throw new Error("Employee save patch: update anchor not found.");
if (!source.includes('const previousScheduleType=String(current.schedule_type||"ADMIN").toUpperCase();')) source = source.replace(anchor, replacement);

const schemaAnchor = 'rotation_days_on INTEGER,rotation_days_off INTEGER,specialties_json TEXT NOT NULL DEFAULT \'[]\',work_days_json TEXT NOT NULL DEFAULT \'[]\',avatar TEXT)"';
const schemaReplacement = 'rotation_days_on INTEGER,rotation_days_off INTEGER,specialties_json TEXT NOT NULL DEFAULT \'[]\',work_days_json TEXT NOT NULL DEFAULT \'[]\',avatar TEXT,early_checkout_grace_minutes INTEGER NOT NULL DEFAULT 0)"';
if (!source.includes(schemaAnchor)) throw new Error("Employee save patch: schema anchor not found.");
if (!source.includes("early_checkout_grace_minutes INTEGER NOT NULL DEFAULT 0")) source = source.replace(schemaAnchor, schemaReplacement);

const outputAnchor = 'workStartTime:r.work_start_time,workEndTime:r.work_end_time,gracePeriodMinutes:r.grace_period_minutes,role:r.role,';
const outputReplacement = 'workStartTime:r.work_start_time,workEndTime:r.work_end_time,gracePeriodMinutes:r.grace_period_minutes,earlyCheckoutGraceMinutes:r.early_checkout_grace_minutes ?? 0,role:r.role,';
if (!source.includes(outputAnchor)) throw new Error("Employee save patch: employee output anchor not found.");
if (!source.includes("earlyCheckoutGraceMinutes:r.early_checkout_grace_minutes")) source = source.replace(outputAnchor, outputReplacement);

const loopAnchor = 'for(const[k,col]of Object.entries({name:"name",status:"status",scheduleType:"schedule_type",rotationStartDate:"rotation_start_date",workStartTime:"work_start_time",workEndTime:"work_end_time",gracePeriodMinutes:"grace_period_minutes",role:"role",locationId:"location_id",rotationDaysOn:"rotation_days_on",rotationDaysOff:"rotation_days_off",avatar:"avatar"}))if(b[k]!==undefined){sets.push(`${col}=?`);values.push(b[k]);}';
const loopReplacement = loopAnchor + 'if(b.earlyCheckoutGraceMinutes!==undefined){sets.push("early_checkout_grace_minutes=?");values.push(Math.min(1440,Math.max(0,Number(b.earlyCheckoutGraceMinutes)||0)));}if(String(b.scheduleType||"").toUpperCase()==="ADMIN"&&previousScheduleType==="ROTATION"){sets.push("work_start_time=?","work_end_time=?","work_days_json=?","rotation_start_date=?","rotation_days_on=?","rotation_days_off=?");values.push("08:00","16:00",JSON.stringify([0,1,2,3,4]),null,null,null);}';
if (!source.includes(loopAnchor)) throw new Error("Employee save patch: field loop anchor not found.");
if (!source.includes('b.earlyCheckoutGraceMinutes!==undefined')) source = source.replace(loopAnchor, loopReplacement);

const insertAnchor = 'rotationDaysOn,rotationDaysOff,specialties_json,work_days_json,avatar) VALUES';
const insertReplacement = 'rotationDaysOn,rotationDaysOff,specialties_json,work_days_json,avatar,early_checkout_grace_minutes) VALUES';
if (!source.includes(insertAnchor)) throw new Error("Employee save patch: employee insert anchor not found.");
if (!source.includes('work_days_json,avatar,early_checkout_grace_minutes) VALUES')) source = source.replace(insertAnchor, insertReplacement);

const insertValuesAnchor = 'JSON.stringify(b.specialties||[]),JSON.stringify(b.workDays||[]),b.avatar||null).run();';
const insertValuesReplacement = 'JSON.stringify(b.specialties||[]),JSON.stringify(b.workDays||[]),b.avatar||null,Math.min(1440,Math.max(0,Number(b.earlyCheckoutGraceMinutes)||0))).run();';
if (!source.includes(insertValuesAnchor)) throw new Error("Employee save patch: employee insert values anchor not found.");
if (!source.includes('b.avatar||null,Math.min(1440')) source = source.replace(insertValuesAnchor, insertValuesReplacement);

const verifyAnchor = 'const employee=await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first<any>();if(jobNumberChanged)await audit(env,req,actor.name,"employee-job-number-update","success",id,String(employee?.job_number||""),`تغيير الرقم الوظيفي من ${previousJobNumber} إلى ${String(employee?.job_number||"")}`);return json({ok:true,employee:employeeOut(employee),...(jobNumberChanged?{previousJobNumber}: {})},200,origin);';
const verifyReplacement = 'const employee=await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first<any>();if(!employee)return json({error:"تعذر قراءة بيانات الموظف بعد الحفظ"},500,origin);const requestedChecks:Array<[string,string]>=[];if(b.name!==undefined)requestedChecks.push(["name",String(b.name)]);if(b.jobNumber!==undefined)requestedChecks.push(["job_number",String(b.jobNumber).trim()]);if(b.scheduleType!==undefined)requestedChecks.push(["schedule_type",String(b.scheduleType).toUpperCase()]);if(b.workStartTime!==undefined)requestedChecks.push(["work_start_time",String(b.workStartTime||"")]);if(b.workEndTime!==undefined)requestedChecks.push(["work_end_time",String(b.workEndTime||"")]);if(b.status!==undefined)requestedChecks.push(["status",String(b.status)]);if(b.workDays!==undefined)requestedChecks.push(["work_days_json",JSON.stringify(b.workDays)]);if(b.earlyCheckoutGraceMinutes!==undefined)requestedChecks.push(["early_checkout_grace_minutes",String(Math.min(1440,Math.max(0,Number(b.earlyCheckoutGraceMinutes)||0)))]);for(const [field,expected] of requestedChecks){const actual=field==="work_days_json"?String(employee[field]||"[]"):String(employee[field]??"");if(actual!==expected&&!(field==="work_days_json"&&actual===JSON.stringify([0,1,2,3,4])&&String(b.scheduleType||"").toUpperCase()==="ADMIN"))return json({error:"الخادم لم يؤكد حفظ جميع تعديلات الموظف في D1",field},500,origin);}if(jobNumberChanged)await audit(env,req,actor.name,"employee-job-number-update","success",id,String(employee?.job_number||""),`تغيير الرقم الوظيفي من ${previousJobNumber} إلى ${String(employee?.job_number||"")}`);return json({ok:true,employee:employeeOut(employee),...(jobNumberChanged?{previousJobNumber}: {})},200,origin);';
if (!source.includes(verifyAnchor)) throw new Error("Employee save patch: verification anchor not found.");
if (!source.includes('الخادم لم يؤكد حفظ جميع تعديلات الموظف في D1')) source = source.replace(verifyAnchor, verifyReplacement);

writeFileSync(file, source, "utf8");
console.log("Employee save/default schedule/checkout patch applied.");
