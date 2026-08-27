import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CalendarDays, ChartNoAxesCombined, CreditCard, IdCard, ListChecks, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { currentSession } from "@/lib/auth";
import { getBackendAttendance, getBackendEmployeeProfile, getBackendRequests } from "@/lib/backend";
import { formatDurationMinutes, minutesBetween } from "@/lib/utils";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").trim().replace(/\/$/, "");
const tabs = [
  ["card", "البطاقة", "بطاقتك الرقمية وQR", IdCard],
  ["overview", "نظرة عامة", "ملخص العمل والالتزام", ChartNoAxesCombined],
  ["calendar", "التقويم", "أيام الحضور والانصراف", CalendarDays],
  ["activity", "النشاط", "الخط الزمني للعمليات", Activity],
  ["schedule", "الدوام", "المناوبة وأوقات العمل", CreditCard],
  ["requests", "الطلبات", "الإجازات والاستئذانات", ListChecks],
  ["security", "الأمان", "الحساب والملف الشخصي", ShieldCheck],
] as const;
type Tab = typeof tabs[number][0];

async function loadAvatarDataUrl(employeeId: string): Promise<string | null> {
  const token = typeof window !== "undefined" ? localStorage.getItem("hadir.api.token.employee") || "" : "";
  if (!employeeId) return null;
  try {
    const response = await fetch(`${API_URL}/api/employees/${encodeURIComponent(employeeId)}/avatar`, { headers: token ? { authorization: `Bearer ${token}` } : {}, credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size) return null;
    return await new Promise<string | null>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => reject(new Error("تعذر قراءة صورة الموظف.")); reader.readAsDataURL(blob); });
  } catch { return null; }
}

const arTime = (v: string) => new Date(v).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
const arDate = (v: string) => new Date(v).toLocaleDateString("ar-EG", { weekday: "short", day: "2-digit", month: "short" });

export default function EmployeeCenter() {
  const session = currentSession();
  const [employee, setEmployee] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("card");
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      try {
        const [profile, a, r] = await Promise.all([getBackendEmployeeProfile(), getBackendAttendance(2000), getBackendRequests()]);
        if (!alive) return;
        setEmployee(profile);
        setAttendance((a || []).filter((x: any) => x.employeeId === session.employeeId));
        setRequests((r || []).filter((x: any) => x.employeeId === session.employeeId));
        setAvatarUrl(await loadAvatarDataUrl(profile.id || session.employeeId || ""));
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "تعذر تحميل مركز الموظف"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session?.employeeId]);

  const pairs = useMemo(() => {
    const map = new Map<string, any>();
    attendance.slice().sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(a => {
      const day = String(a.timestamp).slice(0,10); const row = map.get(day) || { day, in: null, out: null };
      if (a.type === "check-in" || a.type === "in") row.in = a.timestamp;
      if (a.type === "check-out" || a.type === "out") row.out = a.timestamp;
      map.set(day, row);
    });
    return [...map.values()].sort((a,b) => b.day.localeCompare(a.day));
  }, [attendance]);
  const stats = useMemo(() => {
    const worked = pairs.reduce((n,r) => n + (r.in ? minutesBetween(r.in, r.out || new Date().toISOString()) : 0), 0);
    const present = pairs.filter(r => r.in).length;
    const complete = pairs.filter(r => r.in && r.out).length;
    const late = pairs.filter(r => r.in && employee?.workStartTime && new Date(r.in).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"}) > String(employee.workStartTime)).length;
    return { worked, present, complete, late, score: present ? Math.max(0, Math.min(100, Math.round(complete / present * 100 - Math.min(late * 2, 20)))) : 0 };
  }, [pairs, employee]);
  const days = useMemo(() => { const y=month.getFullYear(),m=month.getMonth(),count=new Date(y,m+1,0).getDate(); return Array.from({length:count},(_,i)=>new Date(y,m,i+1)); }, [month]);
  const byDay = useMemo(() => { const map=new Map<string,any[]>(); attendance.forEach(a=>{const k=String(a.timestamp).slice(0,10);map.set(k,[...(map.get(k)||[]),a]);});return map; }, [attendance]);
  const qrValue = employee ? `${window.location.origin}/employee/verify/${encodeURIComponent(employee.id)}` : "";

  if (!session) return null;
  if (loading) return <div className="py-16 grid place-items-center text-sm text-muted-foreground">جاري تجهيز مركز الموظف…</div>;
  if (error || !employee) return <div className="py-16 text-center"><div className="text-destructive text-sm">{error || "تعذر تحميل بيانات الموظف"}</div><Link className="btn-primary inline-flex mt-4" to="/employee">العودة</Link></div>;

  return <div className="space-y-5">
    <section className="hud-card overflow-hidden p-0">
      <div className="p-5 sm:p-6 border-b border-border/60 bg-gradient-to-l from-primary/10 via-background to-background">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-primary/30 bg-primary/10 grid place-items-center shrink-0">
              {avatarUrl ? <img src={avatarUrl} alt={employee.name} className="h-full w-full object-cover" /> : <span className="text-3xl font-black text-primary">{String(employee.name || "م").charAt(0)}</span>}
            </div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">بطاقة الموظف الرقمية</div><h2 className="text-2xl sm:text-3xl font-black mt-1 truncate">{employee.name}</h2><div className="text-sm text-muted-foreground mt-1">{employee.jobNumber} · {employee.department || employee.role || "موظف"}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2 min-w-[220px]"><Info label="الحالة" value={employee.status === "active" ? "نشط" : employee.status || "—"}/><Info label="الدوام" value={`${employee.workStartTime || "08:00"} → ${employee.workEndTime || "16:00"}`}/></div>
        </div>
      </div>
      <div className="p-3 sm:p-4 overflow-x-auto"><div className="flex min-w-max gap-2">{tabs.map(([id,title,desc,Icon]) => <button key={id} onClick={()=>setTab(id)} title={desc} className={`min-w-[92px] rounded-2xl border px-3 py-2.5 text-center transition ${tab===id ? "border-primary/40 bg-primary/10 text-primary shadow-sm" : "border-border/60 hover:border-primary/30 hover:bg-secondary"}`}><Icon className="h-5 w-5 mx-auto"/><div className="text-xs font-black mt-1">{title}</div></button>)}</div></div>
    </section>

    {tab === "card" && <section className="hud-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs text-muted-foreground">هوية الموظف</div><h2 className="font-black text-xl mt-1">بطاقتي الرقمية</h2></div><Link to="/employee/profile" className="btn-secondary text-xs"><UserRound className="inline h-4 w-4 ml-1"/> الملف الشخصي</Link></div><div className="mt-5 max-w-2xl rounded-3xl border border-primary/30 bg-primary/5 p-5 print:border-black"><div className="flex items-center gap-4"><div className="h-28 w-28 rounded-2xl overflow-hidden border bg-background grid place-items-center shrink-0">{avatarUrl?<img src={avatarUrl} alt={employee.name} className="h-full w-full object-cover"/>:<span className="text-4xl font-black text-primary">{String(employee.name||"م").charAt(0)}</span>}</div><div><div className="text-xs text-muted-foreground">Hadir · بطاقة موظف</div><div className="text-2xl font-black mt-1">{employee.name}</div><div className="text-sm text-muted-foreground mt-1">{employee.department || employee.role || "موظف"}</div><div className="mono text-lg mt-2">{employee.jobNumber}</div></div></div><div className="grid grid-cols-2 gap-2 mt-5"><Info label="الحالة" value={employee.status === "active" ? "نشط" : employee.status || "—"}/><Info label="نوع الدوام" value={employee.scheduleType === "ROTATION" ? "تناوبي" : "اعتيادي"}/></div><div className="mt-5 rounded-2xl border bg-background p-4 grid place-items-center"><QRCodeSVG value={qrValue} size={170} includeMargin/><div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><QrCode className="h-3 w-3"/> امسح الرمز لفتح بطاقة التحقق</div></div><button onClick={()=>window.print()} className="btn-primary w-full mt-4">طباعة البطاقة</button></div></section>}

    {tab === "overview" && <><section className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="أيام الحضور" value={stats.present}/><Metric label="أيام مكتملة" value={stats.complete}/><Metric label="التأخير" value={stats.late}/><Metric label="الالتزام" value={`${stats.score}%`}/></section><section className="hud-card p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">ملخص العمل</div><h2 className="font-black text-lg">آخر أيام العمل</h2></div><span className="badge">{formatDurationMinutes(stats.worked)}</span></div><div className="mt-4 space-y-2">{pairs.slice(0,8).map(r=><div key={r.day} className="rounded-2xl border border-border/60 p-3 flex items-center justify-between text-xs"><div><b>{r.day}</b><div className="text-muted-foreground mt-1">{r.in ? arTime(r.in) : "—"} → {r.out ? arTime(r.out) : "مفتوح"}</div></div><span className="badge">{r.in&&r.out?"مكتمل":"مفتوح"}</span></div>)}{!pairs.length&&<Empty/>}</div></section></>}

    {tab === "calendar" && <section className="hud-card p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-xs text-muted-foreground">تقويم الحضور</div><h2 className="font-black text-xl">{month.toLocaleDateString("ar-EG",{month:"long",year:"numeric"})}</h2></div><div className="flex gap-2"><button className="btn-secondary text-xs" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>السابق</button><button className="btn-secondary text-xs" onClick={()=>setMonth(new Date())}>اليوم</button><button className="btn-secondary text-xs" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>التالي</button></div></div><div className="grid grid-cols-7 gap-2 mt-5">{["أحد","اثن","ثلث","أرب","خمي","جمع","سبت"].map(x=><div key={x} className="text-center text-[10px] text-muted-foreground py-2">{x}</div>)}{Array.from({length:days[0].getDay()}).map((_,i)=><div key={`e${i}`}/>) }{days.map(d=>{const k=d.toISOString().slice(0,10),rows=byDay.get(k)||[],hasIn=rows.some(x=>x.type==="check-in"||x.type==="in"),hasOut=rows.some(x=>x.type==="check-out"||x.type==="out");return <button key={k} onClick={()=>setTab("activity")} className={`min-h-20 rounded-xl border p-2 text-right ${hasIn&&hasOut?"bg-primary/10 border-primary/25":hasIn?"bg-accent/10 border-accent/25":"border-border/50"}`}><div className="text-xs font-bold">{d.getDate()}</div><div className="text-[9px] mt-2 text-muted-foreground">{hasIn?"حضور":"—"}</div><div className="text-[9px] text-muted-foreground">{hasOut?"انصراف":""}</div></button>})}</div></section>}

    {tab === "activity" && <section className="hud-card p-5"><h2 className="font-black text-xl">الخط الزمني لنشاطي</h2><p className="text-xs text-muted-foreground mt-1">آخر عمليات الحضور والانصراف.</p><div className="mt-5 space-y-3">{attendance.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,40).map(a=><div key={a.id} className="flex gap-3 items-center"><div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center font-black">{a.type==="check-in"||a.type==="in"?"↓":"↑"}</div><div className="flex-1 rounded-xl border border-border/60 p-3"><div className="flex justify-between gap-2"><b className="text-xs">{a.type==="check-in"||a.type==="in"?"تسجيل حضور":"تسجيل انصراف"}</b><span className="mono text-xs">{arTime(a.timestamp)}</span></div><div className="text-[10px] text-muted-foreground mt-1">{arDate(a.timestamp)} · {a.locationName || "الموقع المسجل"}</div></div></div>)}{!attendance.length&&<Empty/>}</div></section>}

    {tab === "schedule" && <section className="hud-card p-5"><h2 className="font-black text-xl">الدوام والمناوبات</h2><div className="grid sm:grid-cols-3 gap-3 mt-5"><Metric label="نوع الجدول" value={employee.scheduleType === "ROTATION" ? "تناوبي" : "اعتيادي"}/><Metric label="أيام العمل" value={employee.rotationDaysOn ?? employee.workDaysJson ? (employee.rotationDaysOn ?? "محدد") : "—"}/><Metric label="أيام الراحة" value={employee.rotationDaysOff ?? "—"}/></div><div className="mt-4 rounded-2xl border p-4 text-sm">ساعات العمل: <b>{employee.workStartTime || employee.rotationStartTime || "—"}</b> → <b>{employee.workEndTime || employee.rotationEndTime || "—"}</b></div></section>}

    {tab === "requests" && <section className="hud-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-xl">طلباتي</h2><p className="text-xs text-muted-foreground mt-1">الإجازات والاستئذانات والانصراف المبكر.</p></div><Link className="btn-primary text-xs" to="/employee">طلب جديد</Link></div><div className="mt-5 space-y-3">{requests.map(r=><div key={r.id} className="rounded-2xl border border-border/60 p-4 flex items-center justify-between gap-3"><div><div className="font-bold text-sm">{r.type === "permission" ? "استئذان" : r.type === "leave" ? "إجازة" : "انصراف مبكر"}</div><div className="text-xs text-muted-foreground mt-1">{r.reason || "بدون سبب"}</div></div><span className="badge">{r.status === "approved" ? "موافق عليه" : r.status === "confirmed" ? "تم التأكيد" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></div>)}{!requests.length&&<Empty text="لا توجد طلبات حتى الآن."/>}</div></section>}

    {tab === "security" && <section className="hud-card p-5"><h2 className="font-black text-xl">أمان حسابي وملفي</h2><div className="space-y-3 mt-5"><Info label="حالة الحساب" value={employee.status === "active" ? "نشط" : employee.status || "—"}/><Info label="الرقم الوظيفي" value={employee.jobNumber}/><Info label="الطلبات" value={`${requests.length} طلب`}/><Link to="/employee/profile" className="btn-primary inline-flex mt-2"><UserRound className="ml-1 h-4 w-4"/> إدارة الملف الشخصي</Link></div></section>}
  </div>;
}
function Metric({label,value}:{label:string,value:React.ReactNode}){return <div className="hud-card p-4"><div className="text-[10px] text-muted-foreground">{label}</div><div className="text-xl font-black mt-1">{value}</div></div>}
function Info({label,value}:{label:string,value:React.ReactNode}){return <div className="rounded-xl border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-bold text-sm mt-1">{value}</div></div>}
function Empty({text="لا توجد بيانات حتى الآن."}:{text?:string}){return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>}
