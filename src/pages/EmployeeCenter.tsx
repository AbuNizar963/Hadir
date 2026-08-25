import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getBackendAttendance, getBackendEmployeeProfile, getBackendRequests } from "@/lib/backend";
import { formatDurationMinutes, minutesBetween } from "@/lib/utils";

type Tab = "overview" | "calendar" | "timeline" | "requests" | "security";

const arDate = (d: Date) => d.toLocaleDateString("ar-EG", { weekday: "short", day: "2-digit", month: "short" });
const arTime = (v: string) => new Date(v).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

export default function EmployeeCenter() {
  const nav = useNavigate();
  const session = currentSession();
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) { nav("/login", { replace: true }); return; }
    let alive = true;
    (async () => {
      try {
        const [profile, a, r, n] = await Promise.all([
          getBackendEmployeeProfile(),
          getBackendAttendance(2000),
          getBackendRequests(),
          fetch("/api/notifications", { credentials: "include" }).then(x => x.ok ? x.json() : []).catch(() => [])
        ]);
        if (!alive) return;
        setEmployee(profile);
        setAttendance((a || []).filter((x: any) => x.employeeId === session.employeeId));
        setRequests((r || []).filter((x: any) => x.employeeId === session.employeeId));
        setNotifications(Array.isArray(n) ? n : []);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "تعذر تحميل مركز الموظف"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session?.employeeId, nav]);

  const days = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth(), count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
  }, [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    attendance.forEach(a => { const k = String(a.timestamp).slice(0, 10); map.set(k, [...(map.get(k) || []), a]); });
    return map;
  }, [attendance]);
  const pairs = useMemo(() => {
    const map = new Map<string, any>();
    [...attendance].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(a => {
      const k = String(a.timestamp).slice(0, 10); const row = map.get(k) || { day:k, in:null, out:null };
      if (a.type === "check-in" || a.type === "in") row.in = a.timestamp;
      if (a.type === "check-out" || a.type === "out") row.out = a.timestamp;
      map.set(k,row);
    });
    return [...map.values()].sort((a,b) => b.day.localeCompare(a.day));
  }, [attendance]);
  const stats = useMemo(() => {
    const worked = pairs.reduce((sum,r) => sum + (r.in ? minutesBetween(r.in, r.out || new Date().toISOString()) : 0), 0);
    const present = pairs.filter(r => r.in).length;
    const complete = pairs.filter(r => r.in && r.out).length;
    const late = pairs.filter(r => r.in && employee?.workStartTime && arTime(r.in) > String(employee.workStartTime)).length;
    const score = present ? Math.max(0, Math.min(100, Math.round((complete / present) * 100 - Math.min(late * 2, 20)))) : 0;
    return { worked, present, complete, late, score };
  }, [pairs, employee]);
  const timeline = useMemo(() => attendance.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,30), [attendance]);

  const markRead = async (id?: string) => {
    await fetch("/api/notifications/read", { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify(id ? {id} : {}) }).catch(()=>{});
    setNotifications(n => id ? n.map(x => x.id === id ? {...x,readAt:new Date().toISOString()} : x) : n.map(x=>({...x,readAt:new Date().toISOString()})));
  };

  if (!session) return null;
  if (loading) return <Centered>جاري تجهيز مركز الموظف…</Centered>;
  if (error || !employee) return <Centered><div className="text-destructive">{error || "تعذر تحميل بيانات الموظف"}</div><Link className="btn-primary mt-4 inline-flex" to="/employee">العودة</Link></Centered>;

  return <div className="min-h-screen bg-background" dir="rtl">
    <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-3"><Brand/><Link to="/employee" className="btn-ghost text-xs">العودة للرئيسية</Link></header>
    <main className="max-w-5xl mx-auto px-4 pb-12 space-y-5">
      <section className="hud-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-4"><div className="h-20 w-20 rounded-2xl overflow-hidden border border-primary/30 bg-primary/10 grid place-items-center shrink-0">{employee.avatar ? <img src={employee.avatar} alt={employee.name} className="h-full w-full object-cover"/> : <span className="text-3xl font-black text-primary">{String(employee.name||"م").charAt(0)}</span>}</div><div><div className="text-xs text-muted-foreground">بطاقة الموظف الرقمية</div><h1 className="text-2xl font-black mt-1">{employee.name}</h1><div className="text-sm text-muted-foreground mt-1">{employee.jobNumber} · {employee.role || "موظف"}</div></div></div><div className="grid grid-cols-2 gap-2 text-xs min-w-[210px]"><Info label="الحالة" value={employee.status === "active" ? "نشط" : employee.status || "—"}/><Info label="الدوام" value={employee.scheduleType === "ROTATION" ? "تناوبي" : `${employee.workStartTime || "08:00"} → ${employee.workEndTime || "16:00"}`}/></div></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>setTab("overview")} className={tabBtn(tab==="overview")}>نظرة عامة</button><button onClick={()=>setTab("calendar")} className={tabBtn(tab==="calendar")}>التقويم</button><button onClick={()=>setTab("timeline")} className={tabBtn(tab==="timeline")}>النشاط</button><button onClick={()=>setTab("requests")} className={tabBtn(tab==="requests")}>طلباتي</button><button onClick={()=>setTab("security")} className={tabBtn(tab==="security")}>الأمان</button></div></section>

      {tab === "overview" && <>
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="أيام الحضور" value={stats.present}/><Metric label="أيام مكتملة" value={stats.complete}/><Metric label="التأخر" value={stats.late}/><Metric label="الالتزام" value={`${stats.score}%`}/></section>
        <section className="grid lg:grid-cols-[1.5fr_1fr] gap-5"><div className="hud-card p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">هذا السجل</div><h2 className="font-black text-lg">ملخص ساعات العمل</h2></div><span className="badge">{formatDurationMinutes(stats.worked)}</span></div><div className="mt-5 space-y-3">{pairs.slice(0,8).map(r=><div key={r.day} className="rounded-2xl border border-border/60 p-3 flex items-center justify-between gap-3 text-xs"><div><div className="font-bold">{r.day}</div><div className="text-muted-foreground mt-1">{r.in ? arTime(r.in) : "—"} → {r.out ? arTime(r.out) : "مفتوح"}</div></div><span className={`badge ${r.in&&r.out?"bg-primary/10 text-primary":"bg-accent/10 text-accent"}`}>{r.in&&r.out?"مكتمل":"مفتوح"}</span></div>)}{!pairs.length&&<Empty/>}</div></div><div className="hud-card p-5"><h2 className="font-black">الإشعارات</h2><div className="space-y-2 mt-4">{notifications.slice(0,6).map(n=><button key={n.id} onClick={()=>markRead(n.id)} className={`w-full text-right rounded-xl border p-3 ${n.readAt?"border-border/40 opacity-70":"border-primary/30 bg-primary/5"}`}><div className="text-xs font-bold">{n.title}</div><div className="text-[11px] text-muted-foreground mt-1">{n.body}</div></button>)}{!notifications.length&&<Empty text="لا توجد إشعارات جديدة."/>}</div>{notifications.some(n=>!n.readAt)&&<button onClick={()=>markRead()} className="btn-secondary w-full mt-3 text-xs">تعليم الكل كمقروء</button>}</div></section>
        <section className="hud-card p-5"><h2 className="font-black">بطاقة الموظف الرقمية</h2><div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs text-muted-foreground">الرقم الوظيفي</div><div className="mono text-xl font-black mt-1">{employee.jobNumber}</div><div className="text-xs text-muted-foreground mt-2">يمكن استخدام هذه البطاقة للتعريف السريع داخل المؤسسة.</div></div><div className="h-24 w-24 rounded-xl border bg-background grid place-items-center text-3xl font-black">QR</div></div></section>
      </>}

      {tab === "calendar" && <section className="hud-card p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-xs text-muted-foreground">تقويم الحضور</div><h2 className="font-black text-xl">{month.toLocaleDateString("ar-EG",{month:"long",year:"numeric"})}</h2></div><div className="flex gap-2"><button className="btn-secondary" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>السابق</button><button className="btn-secondary" onClick={()=>setMonth(new Date())}>اليوم</button><button className="btn-secondary" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>التالي</button></div></div><div className="grid grid-cols-7 gap-2 mt-5">{["أحد","اثن","ثلث","أرب","خمي","جمع","سبت"].map(x=><div key={x} className="text-center text-[10px] text-muted-foreground py-2">{x}</div>)}{Array.from({length:days[0].getDay()}).map((_,i)=><div key={`e${i}`} />)}{days.map(d=>{const k=d.toISOString().slice(0,10), rows=byDay.get(k)||[], hasIn=rows.some(x=>x.type==="check-in"||x.type==="in"),hasOut=rows.some(x=>x.type==="check-out"||x.type==="out");return <button key={k} onClick={()=>setTab("timeline")} className={`min-h-20 rounded-xl border p-2 text-right hover:border-primary/50 ${hasIn&&hasOut?"bg-primary/10 border-primary/25":hasIn?"bg-accent/10 border-accent/25":"border-border/50"}`}><div className="text-xs font-bold">{d.getDate()}</div><div className="text-[9px] mt-2 text-muted-foreground">{hasIn?"حضور":"—"}</div><div className="text-[9px] text-muted-foreground">{hasOut?"انصراف":""}</div></button>})}</div></section>}

      {tab === "timeline" && <section className="hud-card p-5"><h2 className="font-black text-xl">الخط الزمني للنشاط</h2><p className="text-xs text-muted-foreground mt-1">آخر عمليات الحضور والانصراف مرتبة زمنيًا.</p><div className="mt-5 space-y-3">{timeline.map(a=><div key={a.id} className="flex items-center gap-3"><div className={`h-10 w-10 rounded-xl grid place-items-center font-black ${a.type==="check-in"||a.type==="in"?"bg-primary/10 text-primary":"bg-accent/10 text-accent"}`}>{a.type==="check-in"||a.type==="in"?"↓":"↑"}</div><div className="flex-1 rounded-xl border border-border/60 p-3"><div className="flex justify-between gap-2"><span className="font-bold text-xs">{a.type==="check-in"||a.type==="in"?"تسجيل حضور":"تسجيل انصراف"}</span><span className="mono text-xs">{arTime(a.timestamp)}</span></div><div className="text-[10px] text-muted-foreground mt-1">{arDate(new Date(a.timestamp))} · {a.locationName || "الموقع المسجل"}</div></div></div>)}{!timeline.length&&<Empty/>}</div></section>}

      {tab === "requests" && <section className="hud-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-xl">طلباتي</h2><p className="text-xs text-muted-foreground mt-1">تابع حالة الإجازات والاستئذانات والتعديلات.</p></div><Link className="btn-primary text-xs" to="/employee">طلب جديد</Link></div><div className="mt-5 space-y-3">{requests.map(r=><div key={r.id} className="rounded-2xl border border-border/60 p-4 flex items-center justify-between gap-3"><div><div className="font-bold text-sm">{r.type === "permission" ? "استئذان" : r.type === "leave" ? "إجازة" : "انصراف مبكر"}</div><div className="text-xs text-muted-foreground mt-1">{r.reason || "بدون سبب"}</div></div><span className="badge">{r.status === "approved" ? "موافق عليه" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></div>)}{!requests.length&&<Empty text="لا توجد طلبات حتى الآن."/>}</div></section>}

      {tab === "security" && <section className="grid md:grid-cols-2 gap-5"><div className="hud-card p-5"><h2 className="font-black text-xl">مركز الأمان</h2><div className="space-y-2 mt-4"><Info label="حالة الحساب" value={employee.status === "active" ? "نشط وآمن" : employee.status || "—"}/><Info label="الجهاز" value={employee.deviceLabel || "غير مرتبط"}/><Info label="آخر مزامنة" value={new Date().toLocaleString("ar-EG")}/><Info label="الدور" value={employee.role || "موظف"}/></div><Link to="/employee/profile" className="btn-secondary w-full mt-4 text-center">إدارة كلمة المرور والصورة</Link></div><div className="hud-card p-5"><h2 className="font-black text-xl">إجراءات سريعة</h2><div className="grid gap-2 mt-4"><button className="btn-secondary" onClick={()=>navigator.clipboard?.writeText(String(employee.jobNumber))}>نسخ الرقم الوظيفي</button><button className="btn-secondary" onClick={()=>markRead()}>تحديث حالة الإشعارات</button><Link className="btn-secondary text-center" to="/employee/history">فتح السجل الكامل</Link></div></div></section>}
    </main>
  </div>;
}

function tabBtn(active:boolean){return `rounded-xl border px-3 py-2 text-xs font-bold transition ${active?"border-primary bg-primary/10 text-primary":"border-border/60 hover:bg-secondary"}`}
function Centered({children}:{children:React.ReactNode}){return <div className="min-h-screen grid place-items-center p-5"><div className="hud-card max-w-md w-full p-7 text-center">{children}</div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-border/50 bg-secondary/20 p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-bold text-xs mt-1 truncate">{value}</div></div>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="hud-card p-4"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mono text-2xl font-black mt-1">{value}</div></div>}
function Empty({text="لا توجد بيانات بعد."}:{text?:string}){return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>}
