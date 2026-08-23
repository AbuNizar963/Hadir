export type AIEmployeeRecord = { id: string; name: string; jobNumber?: string; status?: string; role?: string };
export type AIAttendanceRecord = { employeeId: string; type: string; timestamp: string };
export type AIEscapeRecord = { employeeId: string; employeeName?: string; jobNumber?: string; status: string; timestamp: string; reason?: string | null };
export type AIAnswer = { text: string; items?: string[]; hint?: string };
export type AIContext = {
  city?: string;
  weather?: { temp: number; apparent?: number; wind?: number; description?: string };
  prayer?: { fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string; gregorian?: string; hijri?: string };
  qibla?: number;
};
const norm=(v:string)=>v.toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/[ًٌٍَُِّْ]/g,"").trim();
const day=(d=Date.now())=>new Date(d).toISOString().slice(0,10);
const fmt=(d:string)=>new Date(d).toLocaleString("ar-EG",{dateStyle:"medium",timeStyle:"short"});
export const managerExamples=["من هرب هذا الشهر؟","من غاب اليوم؟","كم نسبة الحضور اليوم؟","من أكثر الموظفين تأخرًا؟","من لم يسجل حضورًا اليوم؟","لخص حالة الموظفين اليوم","من أكثر الموظفين حضورًا هذا الشهر؟","كم تسجيل حضور لدينا هذا الشهر؟","اعرض آخر حالات الهروب","كم عدد الموظفين النشطين؟","ما اتجاه الحضور هذا الأسبوع؟","ما حالة الطقس الآن؟","كم درجة الحرارة اليوم؟","ما مواقيت الصلاة اليوم؟","متى صلاة الفجر؟","متى صلاة الظهر؟","متى صلاة المغرب؟","ما اتجاه القبلة؟"];
export const employeeExamples=["متى غبت هذا العام؟","كم مرة تأخرت هذا العام؟","متى كان آخر حضور لي؟","كم يوم حضرت هذا الشهر؟","ما هي مناوبتي اليوم؟","ما آخر تسجيل لي؟","كم تسجيل حضور لدي هذا العام؟","لخص لي حضوري هذا الشهر","ما حالة الطقس الآن؟","كم درجة الحرارة اليوم؟","ما مواقيت الصلاة اليوم؟","متى صلاة الفجر؟","متى صلاة الظهر؟","متى صلاة المغرب؟","ما اتجاه القبلة؟"];
function countDays(rows:AIAttendanceRecord[],type="check-in"){return new Set(rows.filter(a=>a.type===type).map(a=>a.timestamp.slice(0,10))).size;}
function answerContextQuestion(question:string,context?:AIContext):AIAnswer|null{
  const q=norm(question);
  const prayer=context?.prayer;
  const weather=context?.weather;
  if(q.includes("طقس")||q.includes("جو")||q.includes("حراره")||q.includes("درجة الحرارة")||q.includes("درجه الحراره")){
    if(!weather)return{text:"لم يتم تحميل بيانات الطقس بعد. فعّل الموقع ثم أعد السؤال.",hint:"يمكنني الإجابة عن حالة الطقس ودرجة الحرارة وسرعة الرياح."};
    return{text:`الطقس الآن في ${context?.city||"موقعك"}: ${Math.round(weather.temp)}°م${weather.apparent!=null?`، المحسوسة ${Math.round(weather.apparent)}°م`:""}.`,items:[weather.description||"الحالة الحالية متاحة من مزود الطقس","الرياح: "+(weather.wind!=null?`${Math.round(weather.wind)} كم/س`:"غير متاحة") ]};
  }
  if(q.includes("صلاه")||q.includes("الصلاه")||q.includes("مواقيت")||q.includes("الفجر")||q.includes("الشروق")||q.includes("الظهر")||q.includes("العصر")||q.includes("المغرب")||q.includes("العشاء")){
    if(!prayer)return{text:"لم يتم تحميل مواقيت الصلاة بعد. فعّل الموقع ثم أعد السؤال."};
    const names:[keyof typeof prayer,string][]=[["fajr","الفجر"],["sunrise","الشروق"],["dhuhr","الظهر"],["asr","العصر"],["maghrib","المغرب"],["isha","العشاء"]];
    const requested=names.find(([key,name])=>q.includes(norm(name)));
    if(requested)return{text:`موعد ${requested[1]} في ${context?.city||"موقعك"}: ${prayer[requested[0]]}.`,hint:"المواقيت محسوبة وفق طريقة رابطة العالم الإسلامي (Muslim World League)."};
    return{text:`مواقيت الصلاة اليوم في ${context?.city||"موقعك"}:`,items:names.map(([key,name])=>`${name}: ${prayer[key]}`),hint:"المواقيت محسوبة وفق طريقة رابطة العالم الإسلامي (Muslim World League)."};
  }
  if(q.includes("قبله")||q.includes("القبله")||q.includes("اتجاه الكعبه")||q.includes("اتجاه مكة")){
    if(context?.qibla==null)return{text:"لم يتم تحديد اتجاه القبلة بعد. فعّل الموقع ثم أعد السؤال."};
    return{text:`اتجاه القبلة من ${context.city||"موقعك"} هو ${Math.round(context.qibla)}° من الشمال.`,hint:"الزاوية هي الاتجاه الجغرافي نحو الكعبة، ويمكنك فتح صفحة البوصلة للحصول على الاتجاه الحي أثناء تدوير الهاتف."};
  }
  return null;
}
export function answerManagerQuestion(question:string,data:{employees:AIEmployeeRecord[];attendance:AIAttendanceRecord[];escapes:AIEscapeRecord[]},context?:AIContext):AIAnswer{
 const contextAnswer=answerContextQuestion(question,context);if(contextAnswer)return contextAnswer;
 const q=norm(question),now=new Date(),today=day(),active=data.employees.filter(e=>e.status==="active"),checked=new Set(data.attendance.filter(a=>a.type==="check-in"&&a.timestamp.slice(0,10)===today).map(a=>a.employeeId));
 if(q.includes("هرب")||q.includes("هروب")){const start=new Date(now.getFullYear(),now.getMonth(),1).getTime();const rows=data.escapes.filter(e=>e.status==="escaped"&&new Date(e.timestamp).getTime()>=start);return rows.length?{text:`هذا الشهر تم تسجيل ${rows.length} حالة هروب.`,items:rows.slice(0,50).map(e=>`${e.employeeName||e.employeeId}${e.jobNumber?` (${e.jobNumber})`:""} — ${fmt(e.timestamp)}`)}:{text:"لا توجد حالات هروب مسجلة هذا الشهر."};}
 if(q.includes("غاب")||q.includes("غائب")||q.includes("لم يسجل")){const absent=active.filter(e=>!checked.has(e.id));return{text:`يوجد ${absent.length} موظف نشط لم يظهر له تسجيل حضور اليوم.`,items:absent.slice(0,50).map(e=>`${e.name}${e.jobNumber?` (${e.jobNumber})`:""}`),hint:"عدم وجود تسجيل لا يعني بالضرورة غيابًا مؤكدًا قبل مراجعة المناوبة."};}
 if(q.includes("نسبه الحضور")||q.includes("نسبة الحضور")||q.includes("الحضور اليوم")){const rate=active.length?Math.round(checked.size/active.length*100):0;return{text:`نسبة الحضور المسجلة اليوم ${rate}% (${checked.size} من ${active.length}).`};}
 if(q.includes("نشط")||q.includes("عدد الموظفين")){return{text:`يوجد ${active.length} موظف نشط حاليًا من أصل ${data.employees.length}.`};}
 if(q.includes("اكثر حضور")||q.includes("أكثر حضور")){const start=new Date(now.getFullYear(),now.getMonth(),1).getTime(),count=new Map<string,number>();data.attendance.filter(a=>a.type==="check-in"&&new Date(a.timestamp).getTime()>=start).forEach(a=>count.set(a.employeeId,(count.get(a.employeeId)||0)+1));const top=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,n])=>{const e=data.employees.find(x=>x.id===id);return`${e?.name||id}: ${n} تسجيل حضور`;});return{text:"أكثر الموظفين تسجيلًا للحضور هذا الشهر:",items:top.length?top:["لا توجد بيانات كافية."]};}
 if(q.includes("تسجيل حضور")||q.includes("كم تسجيل")){const monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();const n=data.attendance.filter(a=>a.type==="check-in"&&new Date(a.timestamp).getTime()>=monthStart).length;return{text:`تم تسجيل ${n} عملية حضور منذ بداية هذا الشهر.`};}
 if(q.includes("تاخر")||q.includes("متاخر")){const count=new Map<string,number>();data.attendance.filter(a=>a.type==="check-in").forEach(a=>count.set(a.employeeId,(count.get(a.employeeId)||0)+1));const top=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n])=>{const e=data.employees.find(x=>x.id===id);return`${e?.name||id}: ${n} تسجيل حضور`;});return{text:"هذه إحصائية التسجيلات وليست حكمًا على التأخير؛ يلزم جدول المناوبات لحساب التأخير الحقيقي.",items:top.length?top:["لا توجد بيانات حضور كافية."]};}
 if(q.includes("لخص")||q.includes("ملخص")){const rate=active.length?Math.round(checked.size/active.length*100):0;return{text:`ملخص اليوم: ${checked.size} حضروا من ${active.length} موظف نشط (${rate}%). توجد ${data.escapes.filter(e=>e.status==="escaped"&&e.timestamp.slice(0,10)===today).length} حالة هروب مسجلة اليوم.`};}
 return{text:"أستطيع تحليل الحضور والغياب والهروب والتسجيلات والإحصاءات، كما أستطيع الإجابة عن الطقس ومواقيت الصلاة واتجاه القبلة عند توفر الموقع.",hint:managerExamples.join(" • ")};
}
export function answerEmployeeQuestion(question:string,employee:AIEmployeeRecord,attendance:AIAttendanceRecord[],context?:AIContext):AIAnswer{
 const contextAnswer=answerContextQuestion(question,context);if(contextAnswer)return contextAnswer;
 const q=norm(question),now=new Date(),own=attendance.filter(a=>a.employeeId===employee.id),year=now.getFullYear();
 if(q.includes("غبت")||q.includes("غياب")){const days=[...new Set(own.filter(a=>a.type==="check-in"&&new Date(a.timestamp).getFullYear()===year).map(a=>a.timestamp.slice(0,10)))];return{text:`لدي ${days.length} يوم حضور مسجل لك هذا العام. لا أعتبر الأيام غير المسجلة غيابًا مؤكدًا إلا إذا كان جدول المناوبة متاحًا.`,hint:"يمكنني عرض سجلات حضورك المسجلة فقط."};}
 if(q.includes("تاخرت")||q.includes("تأخرت")){const checks=own.filter(a=>a.type==="check-in"&&new Date(a.timestamp).getFullYear()===year);return{text:`لدي ${checks.length} تسجيل حضور لك هذا العام. حساب التأخير الدقيق يحتاج أوقات المناوبات المسجلة من الإدارة.`};}
 if(q.includes("اخر حضور")||q.includes("آخر حضور")||q.includes("اخر تسجيل")){const last=own.filter(a=>a.type==="check-in").sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];return{text:last?`آخر حضور مسجل لك كان ${fmt(last.timestamp)}.`:"لا يوجد حضور مسجل حتى الآن."};}
 if(q.includes("حضرت")||q.includes("حضور")||q.includes("تسجيل")){const month=now.getMonth(),monthDays=new Set(own.filter(a=>a.type==="check-in"&&new Date(a.timestamp).getMonth()===month&&new Date(a.timestamp).getFullYear()===year).map(a=>a.timestamp.slice(0,10)));return{text:`لديك ${monthDays.size} يوم حضور مسجل هذا الشهر و${countDays(own.filter(a=>new Date(a.timestamp).getFullYear()===year))} يوم حضور مسجل هذا العام.`};}
 if(q.includes("مناوب")||q.includes("دوام")){return{text:"لا أستطيع اختراع وقت المناوبة. إذا كانت المناوبة متزامنة من بيانات الإدارة سأعرضها لك، وإلا تحقق من بطاقة المناوبة في الواجهة."};}
 return{text:`مرحبًا ${employee.name}. أستطيع تحليل بيانات حضورك أنت فقط، ولا أطلع على بيانات الموظفين الآخرين.`,hint:employeeExamples.join(" • ")};
}
