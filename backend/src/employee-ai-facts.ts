type FactData = {
  employee?: any;
  attendance?: any[];
  leaveRequests?: any[];
  requests?: any[];
  escapes?: any[];
  notifications?: any[];
  location?: any;
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
function containsAny(q:string,words:string[]){return words.some(w=>q.includes(w));}
function statusLabel(v:any){const s=String(v??"").toLowerCase();if(s.includes("pending")||s.includes("معلق")||s.includes("قيد"))return "قيد الانتظار";if(s.includes("approved")||s.includes("موافق")||s.includes("معتمد"))return "مقبول/معتمد";if(s.includes("rejected")||s.includes("مرفوض"))return "مرفوض";if(s.includes("cancel"))return "ملغى";if(s.includes("confirmed"))return "مؤكد";return String(v??"غير محدد");}

export function employeeFactAnswer(question:string,data:FactData):string|null{
 const q=n(question);const e=data?.employee||{};const a=Array.isArray(data?.attendance)?data.attendance:[];const requests=Array.isArray(data?.requests)?data.requests:[];const escapes=Array.isArray(data?.escapes)?data.escapes:[];const notifications=Array.isArray(data?.notifications)?data.notifications:[];const leaves=(Array.isArray(data?.leaveRequests)?data.leaveRequests:[]);
 const approvedLeaves=leaves.filter((r:any)=>approved(r.status));
 const today=zoneToday(),year=today.slice(0,4),month=today.slice(0,7);
 const events=a.filter((x:any)=>String(x.timestamp)).sort((x:any,y:any)=>String(y.timestamp).localeCompare(String(x.timestamp)));
 const ins=events.filter((x:any)=>inEvent(x.type));
 const outs=events.filter((x:any)=>outEvent(x.type));
 const yearIns=ins.filter((x:any)=>day(x.timestamp).startsWith(year));
 const monthIns=ins.filter((x:any)=>day(x.timestamp).startsWith(month));
 const yearOuts=outs.filter((x:any)=>day(x.timestamp).startsWith(year));
 const monthOuts=outs.filter((x:any)=>day(x.timestamp).startsWith(month));
 const late=yearIns.filter((x:any)=>{const ts=new Date(x.timestamp);const m=/^(\d{1,2}):(\d{2})/.exec(String(e.workStartTime||"08:00"));if(Number.isNaN(ts.getTime())||!m)return false;const scheduled=new Date(ts);scheduled.setHours(Number(m[1]),Number(m[2]),0,0);return ts.getTime()>scheduled.getTime()+Number(e.gracePeriodMinutes||0)*60000;});
 const ranges=approvedLeaves.map((r:any)=>({s:day(r.startDate||r.start_date),e:day(r.endDate||r.end_date||r.startDate||r.start_date)})).filter((r:any)=>r.s);
 const isLeave=(d:string)=>ranges.some((r:any)=>d>=r.s&&d<=r.e);
 const wd=workDays(e);const workedDays=new Set(yearIns.map((x:any)=>day(x.timestamp)));const absence:string[]=[];
 if(wd.length){const start=utcDate(`${year}-01-01`),end=utcDate(today);for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){const ds=iso(d);if(wd.includes(d.getUTCDay())&&!isLeave(ds)&&!workedDays.has(ds))absence.push(ds);}}
 const now=new Date();const period=activeWorkPeriod(e,now);const currentlyWorking=isCurrentlyWorking(e,a,now);
 const lastIn=ins[0];const lastOut=outs[0];
 const todayIns=ins.filter((x:any)=>day(x.timestamp)===today);const todayOuts=outs.filter((x:any)=>day(x.timestamp)===today);
 if(/(كم|عدد).*(موظف|موظفين)|كم موظف لدي|عدد الموظفين/.test(q))return "كمساعد موظف، لا أملك صلاحية الاطلاع على عدد الموظفين أو بيانات الموظفين الآخرين. يمكنني فقط مساعدتك في بيانات حضورك وبيانات حسابك.";
 if(containsAny(q,["من أنا","مين أنا","معلوماتي","بياناتي","ملفي","الرقم الوظيفي","رقمي الوظيفي","وظيفتي"]))return `بياناتك: الاسم ${e.name||"غير محدد"}، الرقم الوظيفي ${e.jobNumber||"غير محدد"}، الحالة ${e.status==="active"?"نشط":"غير نشط"}، نوع الجدول ${isRotation(e)?"تناوبي":"إداري"}.`;
 if(containsAny(q,["تخصص","تخصصاتي","اختصاص"])) {try{const s=JSON.parse(String(e.specialtiesJson||"[]"));if(Array.isArray(s)&&s.length)return `تخصصاتك: ${s.join("، ")}.`; }catch{} return "لا توجد تخصصات مسجلة في بياناتك.";}
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return `تأخرت ${late.length} ${late.length===1?"مرة":"مرات"} هذا العام.`;
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا الشهر|الشهر)/.test(q)){const c=late.filter((x:any)=>day(x.timestamp).startsWith(month)).length;return `تأخرت ${c} ${c===1?"مرة":"مرات"} هذا الشهر.`;}
 if(/متى.*(غبت|غيبت|غياب)|أيام.*(غبت|غياب)|تاريخ.*(غياب)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return wd.length?(absence.length?`أيام غيابك هذا العام (${absence.length}): ${absence.map(dateLabel).join("، ")}.`:`لا توجد أيام غياب محسوبة لك هذا العام وفق جدول دوامك والإجازات المعتمدة.`):"لا أستطيع حساب أيام الغياب بدقة لأن جدول أيام العمل الخاص بك غير متوفر بشكل كافٍ.";
 if(/(كم يوم.*(حضرت|حضور))|(عدد.*أيام.*الحضور)/.test(q)&&/(هذا الشهر|الشهر)/.test(q))return `حضرت ${new Set(monthIns.map((x:any)=>day(x.timestamp))).size} يومًا هذا الشهر.`;
 if(/(كم يوم.*(حضرت|حضور))|(عدد.*أيام.*الحضور)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return `حضرت ${new Set(yearIns.map((x:any)=>day(x.timestamp))).size} يومًا هذا العام.`;
 if(containsAny(q,["حضرت اليوم","حضور اليوم","سجلت حضور اليوم","هل حضرت اليوم"]))return todayIns.length?`نعم، لديك ${todayIns.length} تسجيل حضور اليوم، وآخرها الساعة ${new Date(todayIns[0].timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لديك تسجيل حضور اليوم.`;
 if(containsAny(q,["انصرفت اليوم","انصراف اليوم","سجلت انصراف اليوم","هل انصرفت اليوم"]))return todayOuts.length?`نعم، لديك تسجيل انصراف اليوم، وآخره الساعة ${new Date(todayOuts[0].timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لديك تسجيل انصراف اليوم.`;
 if(containsAny(q,["أنا في العمل","انا في العمل","بالعمل الآن","في العمل الآن","أعمل الآن","اعمل الآن","هل أنا في العمل"]))return currentlyWorking?"نعم، أنت في العمل حاليًا وفق آخر تسجيل حضور وجدول دوامك.":"لا يظهر أنك في العمل حاليًا وفق آخر تسجيل حضور وجدول دوامك.";
 if(containsAny(q,["آخر حضور","اخر حضور","متى كان آخر حضور","آخر مرة حضرت"]))return lastIn?`آخر حضور لك كان ${dateLabel(day(lastIn.timestamp))} الساعة ${new Date(lastIn.timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لدي تسجيل حضور لك.`;
 if(containsAny(q,["آخر انصراف","اخر انصراف","متى انصرفت آخر مرة"]))return lastOut?`آخر انصراف لك كان ${dateLabel(day(lastOut.timestamp))} الساعة ${new Date(lastOut.timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لدي تسجيل انصراف لك.`;
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
 if(containsAny(q,["طلباتى","طلباتي","طلبات","حالة الطلب","حالات طلباتي"])){
   if(!requests.length)return "لا توجد طلبات مسجلة لك في السجلات المتاحة.";
   const recent=requests.slice(0,10).map((r:any)=>`${r.type||"طلب"}: ${statusLabel(r.status)}${r.reason?` (${r.reason})`:""}`).join("؛ ");
   return `لديك ${requests.length} طلبًا مسجلًا. أحدث الطلبات: ${recent}.`;
 }
 if(containsAny(q,["إجازاتي","اجازاتي","إجازة","اجازة"])){
   if(!leaves.length)return "لا توجد إجازات مسجلة لك في السجلات المتاحة.";
   const recent=leaves.slice(0,10).map((r:any)=>`${r.type||"إجازة"}: ${statusLabel(r.status)} من ${dateLabel(day(r.startDate||r.start_date))}${day(r.endDate||r.end_date)?` إلى ${dateLabel(day(r.endDate||r.end_date))}`:""}`).join("؛ ");
   return `لديك ${leaves.length} طلب/سجل إجازة. التفاصيل الأحدث: ${recent}.`;
 }
 if(containsAny(q,["الهروب","هروب","حالات الهروب"])){
   if(!escapes.length)return "لا توجد حالات هروب مسجلة لك في السجلات المتاحة.";
   return `لديك ${escapes.length} حالة هروب مسجلة. أحدثها: ${escapes.slice(0,10).map((r:any)=>`${dateLabel(day(r.timestamp))} ${r.reason?`- ${r.reason}`:""} (${statusLabel(r.status)})`).join("؛ ")}.`;
 }
 if(containsAny(q,["الإشعارات","اشعارات","إشعاراتي","التنبيهات","تنبيهاتي"])){
   if(!notifications.length)return "لا توجد إشعارات متاحة لك حاليًا.";
   return `لديك ${notifications.length} إشعارًا متاحًا. أحدثها: ${notifications.slice(0,10).map((r:any)=>`${r.title||"إشعار"}${r.body?`: ${r.body}`:""}`).join("؛ ")}.`;
 }
 if(containsAny(q,["مكان العمل","موقع العمل","موقعي","الموقع المخصص"]))return data.location?.name?`موقع العمل المسجل لك هو: ${data.location.name}.`:"لا يوجد موقع عمل محدد مسجل في بياناتك.";
 if(containsAny(q,["وقت الدوام","ساعات الدوام","متى يبدأ دوامي","متى ينتهي دوامي"]))return `وقت دوامك المسجل: من ${e.workStartTime||"غير محدد"} إلى ${e.workEndTime||"غير محدد"}. وفترة السماح ${Number(e.gracePeriodMinutes||0)} دقيقة.`;
 if(containsAny(q,["الإجازة اليوم","اجازة اليوم","هل لدي إجازة اليوم"]))return isLeave(today)?"لديك إجازة معتمدة اليوم.":"لا توجد إجازة معتمدة لك اليوم.";
 return null;
}
