import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getBackendAttendance, getBackendEmployeeProfile, getBackendRequests } from "@/lib/backend";
import { formatDurationMinutes, minutesBetween } from "@/lib/utils";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

const tabs = [
  ["card", "بطاقتي الرقمية", "بطاقة تعريف قابلة للطباعة مع QR"],
  ["timeline", "نشاطي", "الخط الزمني للحضور والانصراف"],
  ["schedule", "مناوباتي", "الدورة والمناوبة القادمة"],
  ["performance", "أدائي", "الحضور والتأخير وساعات العمل"],
  ["security", "أمان حسابي", "الجلسة وطلبات الحساب"],
] as const;
type Tab = typeof tabs[number][0];

async function loadAvatarDataUrl(employeeId: string): Promise<string | null> {
  const token = typeof window !== "undefined" ? localStorage.getItem("hadir.api.token.employee") || "" : "";
  if (!employeeId) return null;
  try {
    const response = await fetch(`${API_URL}/api/employees/${encodeURIComponent(employeeId)}/avatar`, {
      method: "GET",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size) return null;
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(new Error("تعذر قراءة صورة الموظف."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function EmployeePremium() {
  const session = currentSession();
  const [employee, setEmployee] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("card");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!session) return;
    (async () => {
      try {
        const [profile, a, r] = await Promise.all([getBackendEmployeeProfile(), getBackendAttendance(2000), getBackendRequests()]);
        if (!alive) return;
        setEmployee(profile);
        setAttendance((a || []).filter((x: any) => x.employeeId === session.employeeId));
        setRequests((r || []).filter((x: any) => x.employeeId === session.employeeId));
        const avatar = await loadAvatarDataUrl(profile.id || session.employeeId || "");
        if (alive) setAvatarUrl(avatar);
      } finally { if (alive) setLoading(false); }
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
  const worked = pairs.reduce((n,r) => n + (r.in ? minutesBetween(r.in, r.out || new Date().toISOString()) : 0), 0);
  const present = pairs.filter(r => r.in).length;
  const complete = pairs.filter(r => r.in && r.out).length;
  const late = pairs.filter(r => r.in && employee?.workStartTime && new Date(r.in).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"}) > employee.workStartTime).length;
  const qrValue = employee ? `${window.location.origin}/employee/verify/${encodeURIComponent(employee.id)}` : "";

  if (!session) return null;
  if (loading || !employee) return <div className="min-h-screen grid place-items-center" dir="rtl"><div className="text-sm">جاري تجهيز الميزات الاحترافية…</div></div>;
  return <div className="min-h-screen bg-background" dir="rtl">
    <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between"><Brand/><Link to="/employee" className="btn-ghost text-xs">العودة للرئيسية</Link></header>
    <main className="max-w-5xl mx-auto px-4 pb-12 space-y-5">
      <section className="hud-card p-5"><div className="text-xs text-muted-foreground">Hadir Premium</div><h1 className="text-2xl font-black mt-1">مركز ميزات الموظف</h1><div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-5">{tabs.map(([id,title,desc]) => <button key={id} onClick={()=>setTab(id)} className={`text-right rounded-2xl border p-3 transition ${tab===id?"border-primary bg-primary/10":"border-border/60 hover:border-primary/40"}`}><div className="font-black text-sm">{title}</div><div className="text-[10px] text-muted-foreground mt-1">{desc}</div></button>)}</div></section>
      {tab === "card" && <section className="hud-card p-5"><h2 className="font-black text-xl">بطاقتي الرقمية</h2><div className="mt-4 max-w-xl rounded-3xl border border-primary/30 bg-primary/5 p-5"><div className="flex items-center gap-4"><div className="h-24 w-24 rounded-2xl overflow-hidden border bg-background grid place-items-center">{avatarUrl?<img src={avatarUrl} alt={employee.name} className="h-full w-full object-cover"/>:<span className="text-3xl font-black text-primary">{String(employee.name||"م").charAt(0)}</span>}</div><div><div className="text-xs text-muted-foreground">Hadir · بطاقة موظف</div><div className="text-2xl font-black">{employee.name}</div><div className="text-sm text-muted-foreground">{employee.department || employee.role || "موظف"}</div><div className="mono mt-2">{employee.jobNumber}</div></div></div><div className="grid grid-cols-2 gap-2 mt-5"><div className="rounded-xl border p-3 text-xs"><div className="text-muted-foreground">الحالة</div><b>{employee.status === "active" ? "نشط" : employee.status || "—"}</b></div><div className="rounded-xl border p-3 text-xs"><div className="text-muted-foreground">نوع الدوام</div><b>{employee.scheduleType === "ROTATION" ? "تناوبي" : "اعتيادي"}</b></div></div><div className="mt-5 rounded-2xl border bg-background p-4 grid place-items-center"><QRCodeSVG value={qrValue} size={170} includeMargin/><div className="text-[10px] text-muted-foreground mt-2">امسح الرمز لفتح بطاقة التحقق</div></div><button onClick={()=>window.print()} className="btn-primary w-full mt-4">طباعة البطاقة</button></div></section>}
      {tab === "timeline" && <section className="hud-card p-5"><h2 className="font-black text-xl">الخط الزمني لنشاطي</h2><div className="mt-5 space-y-3">{attendance.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,40).map(a=><div key={a.id} className="flex gap-3 items-center"><div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center font-black">{a.type==="check-in"||a.type==="in"?"↓":"↑"}</div><div className="flex-1 border rounded-xl p-3"><div className="font-bold text-xs">{a.type==="check-in"||a.type==="in"?"تسجيل حضور":"تسجيل انصراف"}</div><div className="text-[10px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleString("ar-EG")}</div></div></div>)}{!attendance.length&&<Empty/>}</div></section>}
      {tab === "schedule" && <section className="hud-card p-5"><h2 className="font-black text-xl">مناوباتي</h2><div className="grid sm:grid-cols-3 gap-3 mt-5"><Metric label="نوع الجدول" value={employee.scheduleType === "ROTATION" ? "ROTATION" : "اعتيادي"}/><Metric label="أيام العمل" value={employee.rotationDaysOn ?? "—"}/><Metric label="أيام الراحة" value={employee.rotationDaysOff ?? "—"}/></div><div className="mt-4 rounded-2xl border p-4 text-sm">الدوام: <b>{employee.workStartTime || employee.rotationStartTime || "—"}</b> → <b>{employee.workEndTime || employee.rotationEndTime || "—"}</b></div></section>}
      {tab === "performance" && <section className="hud-card p-5"><h2 className="font-black text-xl">أدائي وإحصائياتي</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><Metric label="أيام الحضور" value={present}/><Metric label="مكتمل" value={complete}/><Metric label="التأخير" value={late}/><Metric label="ساعات العمل" value={formatDurationMinutes(worked)}/></div><div className="mt-5 rounded-2xl border p-4"><div className="text-xs text-muted-foreground">نسبة اكتمال تسجيلات الحضور</div><div className="text-3xl font-black text-primary mt-1">{present ? Math.round(complete/present*100) : 0}%</div></div></section>}
      {tab === "security" && <section className="hud-card p-5"><h2 className="font-black text-xl">أمان حسابي</h2><div className="space-y-3 mt-5"><Info label="حالة الحساب" value={employee.status === "active" ? "نشط" : employee.status || "—"}/><Info label="الرقم الوظيفي" value={employee.jobNumber}/><Info label="الطلبات" value={`${requests.length} طلب`}/><Link to="/employee/profile" className="btn-primary inline-flex mt-2">إدارة كلمة المرور والصورة</Link></div></section>}
    </main>
  </div>;
}
function Metric({label,value}:{label:string,value:React.ReactNode}){return <div className="hud-card p-4"><div className="text-[10px] text-muted-foreground">{label}</div><div className="text-xl font-black mt-1">{value}</div></div>}
function Info({label,value}:{label:string,value:React.ReactNode}){return <div className="rounded-xl border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-bold text-sm mt-1">{value}</div></div>}
function Empty(){return <div className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات حتى الآن.</div>