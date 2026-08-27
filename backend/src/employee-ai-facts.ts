type FactData = {
  employee?: any;
  attendance?: any[];
  leaveRequests?: any[];
};
function n(v:any){return String(v??"").trim().toLowerCase();}
function day(v:any){const s=String(v??"");return s.length>=10?s.slice(0,10):"";}
function inEvent(type:any){const t=n(type);return t.includes("check-in")||t.includes("check in")||t==="in"||t.includes("حضور")||t.includes("دخول")||t.includes("تسجيل دخول");}
function approved(status:any){return /(approved|accept|موافق|معتمد|مقبول)/iu.test(String(status??""));}
function zoneToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Damascus",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function workDays(e:any){try{const a=JSON.parse(String(e?.workDaysJson||"[]"));return Array.isArray(a)?a.map(Number).filter((x:number)=>Number.isInteger(x)&&x>=0&&x<=6):[];}catch{return[];}}
function utcDate(s:string){const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));}
function iso(d:Date){return d.toISOString().slice(0,10);}
function dateLabel(s:string){if(!s)return "";const [y,m,d]=s.split("-");return `${d}/${m}/${y}`;}
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
 const todayDay=utcDate(today).getUTCDay();const scheduledToday=wd.includes(todayDay);
 const last=ins[0];
 if(/(كم|عدد).*(موظف|موظفين)|كم موظف لدي|عدد الموظفين/.test(q))return "كمساعد موظف، لا أملك صلاحية الاطلاع على عدد الموظفين أو بيانات الموظفين الآخرين. يمكنني فقط مساعدتك في بيانات حضورك أنت.";
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return `تأخرت ${late.length} ${late.length===1?"مرة":"مرات"} هذا العام.`;
 if(/(كم مرة|عدد مرات).*(تأخر|متأخر)/.test(q)&&/(هذا الشهر|الشهر)/.test(q)){const c=late.filter((x:any)=>day(x.timestamp).startsWith(month)).length;return `تأخرت ${c} ${c===1?"مرة":"مرات"} هذا الشهر.`;}
 if(/متى.*(غبت|غيبت|غياب)|أيام.*(غبت|غياب)|تاريخ.*(غياب)/.test(q)&&/(هذا العام|السنة|عام)/.test(q))return wd.length?(absence.length?`أيام غيابك هذا العام (${absence.length}): ${absence.map(dateLabel).join("، ")}.`:`لا توجد أيام غياب محسوبة لك هذا العام وفق جدول دوامك والإجازات المعتمدة.`):"لا أستطيع حساب أيام الغياب بدقة لأن جدول أيام العمل الخاص بك غير متوفر بشكل كافٍ.";
 if(/كم يوم.*(حضرت|حضور)/.test(q)&&/(هذا الشهر|الشهر)/.test(q))return `حضرت ${new Set(monthIns.map((x:any)=>day(x.timestamp))).size} يومًا هذا الشهر.`;
 if(/(آخر|اخر).*حضور|متى.*حضور.*لي/.test(q))return last?`آخر حضور لك كان ${dateLabel(day(last.timestamp))} الساعة ${new Date(last.timestamp).toLocaleTimeString("ar-SY",{timeZone:"Asia/Damascus",hour:"2-digit",minute:"2-digit"})}.`:`لا يوجد لدي تسجيل حضور لك.`;
 if(/(مناوب|جدول|دوام).*(اليوم|اليوم؟)|اليوم.*(مناوب|جدول|دوام)/.test(q)){
  if(String(e.scheduleType||"").toUpperCase().includes("ROTATION")||String(e.scheduleType||"").includes("تناوب"))return scheduledToday?`مناوبتك اليوم ضمن جدولك التناوبي. وقت الدوام المسجل: ${e.workStartTime||"غير محدد"} إلى ${e.workEndTime||"غير محدد"}.`:`بحسب جدولك المسجل، اليوم ليس يوم دوام ضمن الأيام المحددة.`;
  return scheduledToday?`دوامك اليوم من ${e.workStartTime||"غير محدد"} إلى ${e.workEndTime||"غير محدد"}.`:`اليوم ليس يوم دوام لك بحسب جدولك المسجل.`;
 }
 if(/(إجاز|اجاز).*(هذا العام|السنة|عام)|متى.*(إجاز|اجاز)/.test(q))return leaves.length?`لديك ${leaves.length} إجازة معتمدة في السجلات المتاحة.`:"لا توجد إجازات معتمدة في السجلات المتاحة.";
 return null;
}
