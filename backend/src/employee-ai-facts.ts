type FactData = {
  employee?: any;
  attendance?: any[];
  leaveRequests?: any[];
};

function n(v:any){return String(v??"").trim().toLowerCase();}
function day(v:any){const s=String(v??"");return s.length>=10?s.slice(0,10):"";}
function inEvent(type:any){const t=n(type);return t.includes("check-in")||t.includes("check in")||t==="in"||t.includes("حضور")||t.includes("دخول")||t.includes("تسجيل دخول");}
function outEvent(type:any){const t=n(type);return t.includes("check-out")||t.includes("check out")||t==="out"||t.includes("انصراف")||t.includes("خروج")||t.includes("تسجيل خروج");}
function approved(status:any){return /(approved|accept|موافق|معتمد|مقبول)/iu.test(String(status??""));}
function zoneToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Damascus",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function workDays(e:any){try{const a=JSON.parse(String(e?.workDaysJson||"[]"));return Array.isArray(a)?a.map(Number).filter((x:number)=>Number.isInteger(x)&&x>=0&&x<=6):[];}catch{return[];}}
function utcDate(s:string){const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));}
function iso(d:Date){return d.toISOString().slice(0,10);}
function dateLabel(s:string){if(!s)return "";const [y,m,d]=s.split("-");return `${d}/${m}/${y}`;}
function parseTime(value:any,fallback="08:00"){const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||fallback).trim());return {h:m?Math.min(23,Math.max(0,Number(m[1]))):Number(fallback.slice(0,2)),m:m?Math.min(59,Math.max(0,Number(m[2]))):Number(fallback.slice(3,5))};}
function withTime(d:Date,t:{h:number,m:number}){const x=new Date(d);x.setHours(t.h,t.m,0,0);return x;}
function isRotation(e:any){return String(e?.scheduleType||"").toUpperCase()==="ROTATION"||n(e?.scheduleType).includes("تناوب");}
function activeWorkPeriod(e:any,target:Date){
  if(!e)return {isWorkDay:false,start:null as Date|null,end:null as Date|null,label:"غير محدد"};
  if(!isRotation(e)){
    const wd=workDays(e); const d=target.getDay();
    if(!wd.includes(d))return {isWorkDay:false,start:null as Date|null,end:null as Date|null,label:"إجازة أسبوعية"};
    const start=withTime(target,parseTime(e.workStartTime,"09:00"));
    let end=withTime(target,parseTime(e.workEndTime,"16:00"));
    if(end<=start)end=new Date(end.getTime()+86400000);
    return {isWorkDay:true,start,end,label:"دوام إداري"};
  }
  const raw=String(e.rotationStartDate||"").trim();
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw); if(!m)return {isWorkDay:false,start:null as Date|null,end:null as Date|null,label:"جدول تناوبي غير مكتمل"};
  const base=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const t=parseTime(e.rotationStartTime||e.workStartTime,"09:00"); const first=withTime(base,t);
  const on=Math.max(1,Math.floor(Number(e.rotationDaysOn??4))); const off=Math.max(0,Math.floor(Number(e.rotationDaysOff??4))); const cycle=(on+off)*86400000;
  const elapsed=target.getTime()-first.getTime(); if(elapsed<0)return {isWorkDay:false,start:null as Date|null,end:null as Date|null,label:"لم تبدأ المناوبة بعد"};
  const idx=Math.floor(elapsed/cycle); const within=elapsed-idx*cycle; const cycleDay=Math.floor(within/86400000); const start=new Date(first.getTime()+idx*cycle);
  if(cycleDay>=on)return {isWorkDay:false,start:null as Date|null,end:null as Date|null,label:"فترة راحة",cycleDay:cycleDay+1,on,off};
  return {isWorkDay:true,start,end:new Date(start.getTime()+on*86400000),label:"مناوبة تناوبية",cycleDay:cycleDay+1,on,off};
}
function isCurrentlyWorking(e:any,events:any[],now=new Date()){
  const p=activeWorkPeriod(e,now); if(!p.isWorkDay||!p.start||!p.end||now<p.start||now>=p.end)return false;
  const relevant=events.filter((x:any)=>String(x.timestamp)&&new Date(x.timestamp).getTime()<=now.getTime()).sort((x:any,y:any)=>new Date(y.timestamp).getTime()-new Date(x.timestamp).getTime());
  const last=relevant[0]; if(!last)return false; return inEvent(last.type)&&!outEvent(last.type);
}

export function employeeFactAnswer(question:string,data:FactData):string|null{
 const q=n(question);const e=data?.employee||{};const a=Array.isArray(data?.attendance)?data.attendance:[];const leaves=(Array.isArray(data?.leaveRequests)?data.leaveRequests:[]).filter((r:any)=>approved(r.status));
 const today=zoneToday(),year=today.slice(0,4),month=today.slice(0,7);
 const ins=a.filter((x:any)=>inEvent(x.type)&&String(x.timestamp)).sort((x:any,y:any)=>String(y.timestamp).localeCompare(String(x.timestamp)));
 const yearIns=ins.filter((x:any)=>day(x.timestamp).startsWith(year));
 const monthIns=ins.filter((x:any)=>day(x.timestamp).startsWith(month));
 const late=yearIns.filter((x:any)=>{const ts=new Date(x.timestamp);const m=/^(\d{1,2}):(\d{2})/.exec(String(e.workStartTime||"08:00"));if(Number.isNaN(ts.getTime())||!m)return false;const scheduled=new Date(ts);scheduled.setHours(Number(m[1]),Number(m[2]),0,0);return ts.getTime()>scheduled.getTime()+Number(e.gracePeriodMinutes||0)*60000;});
 const ranges=leaves.map((r:any)=>({s:day(r.startDate||r.start_date),e:day(r.endDate||r.end_date||r.startDate||r.start_date)})).filter((r:any)=>r.s);
 const isLeave=(d:string)=>ranges.some((r:any)=>d>=r.s&&d<=r.e);
 const wd=workDays(e);const workedDays=new Set(yearIns.map((x:any)=>day(x.timestamp)));const absence:string[]=[];
 if(wd.length){const start=utcDate(`${year}-01-01`),end=utcDate(today);for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){const ds=iso(d);if(wd.includes(d.getUTCDay())&&!isLeave(ds)&&!workedDays.has(ds))absence.push(ds);}}
 const now=new Date();const period=activeWorkPeriod(e,now);const currentlyWorking=isCurrentlyWorking(e,a,now);
 const last=ins[0];
 if(/(كم|عدد).*(موظف|موظفين)|كم موظف لدي|عدد الموظفين/.test(q))return "كمساعد موظف، لا أملك صلاحية الاطلاع على عدد الموظفين أو بيانات الموظفين الآخرين. يمكنني فقط مساعدتك في بيانات حضورك أنت.";
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return `تأخرت ${late.length} ${late.length===1?"مرة":"مرات"} هذا العام.`;
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا الشهر|الشهر)/.test(q)){const c=late.filter((x:any)=>day(x.timestamp).startsWith(month)).length;return `تأخرت ${c} ${c===1?"مرة":"مرات"} هذا الشهر.`;}
 if(/متى.*(غبت|غيبت|غياب)|أيام.*(غبت|غياب)|تاريخ.*(غياب)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return wd.length?(absence.length?`أيام غيابك هذا العام (${absence.length}): ${absence.map(dateLabel).join("، ")}.`:`لا توجد أيام غياب محسوبة لك هذا العام وفق جدول دوامك والإجازات المعتمدة.`):"لا أستطيع حساب أيام الغياب بدقة لأن جدول أيام العمل الخاص بك غير متوفر بشكل كافٍ.";
 if(/كم يوم.*(حضرت|حضور)/.test(q)&&/(هذا الشهر|الشهر)/.test(q))return `حضرت ${new Set(monthIns.map((x:any)=>day(x.timestamp))).size} يومًا هذا الشهر.`;
 if(/(أنا|انا).*(في|ب).*(العمل|شغل)|هل.*(أنا|انا).*(في|بالعمل)|هل.*(أعمل|اعمل).*الآن|في.*العمل.*الآن/.test(q))return currentlyWorking?"نعم، أنت في العمل حاليًا وفق آخر تسجيل حضور وجدول دوامك.":"لا يظهر أنك في العمل حاليًا وفق آخر تسجيل حضور وجدول دوامك.";
 if(/(آخر|اخر).*حضور|متى.*حضور.*لي/.test(q))return last?`آخر حضور لك كان ${dateLabel(day(last.timestamp))} الساعة ${new Date(last.timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لدي تسجيل حضور لك.`;
 if(/(مناوب|جدول|دوام).*(اليوم|اليوم؟)|اليوم.*(مناوب|جدول|دوام)/.test(q)){
   if(isRotation(e)){
     if(period.isWorkDay){
       const startText=period.start?.toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"});
       const endText=period.end?.toLocaleString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"});
       return `مناوبتك اليوم قائمة. أنت في اليوم ${period.cycleDay} من ${period.on} يوم عمل ضمن دورة ${period.on}/${period.off}. بداية المناوبة ${startText} وتنتهي ${endText}.`;
     }
     return `اليوم ضمن فترة الراحة في جدولك التناوبي.`;
   }
   if(period.isWorkDay)return `دوامك اليوم من ${e.workStartTime||"غير محدد"} إلى ${e.workEndTime||"غير محدد"}.`;
   return `اليوم ليس يوم دوام لك بحسب جدولك المسجل.`;
 }
 if(/(إجاز|اجاز).*(هذا العام|السنة|عام)|متى.*(إجاز|اجاز)/.test(q))return leaves.length?`لديك ${leaves.length} إجازة معتمدة في السجلات المتاحة.`:"لا توجد إجازات معتمدة في السجلات المتاحة.";
 return null;
}