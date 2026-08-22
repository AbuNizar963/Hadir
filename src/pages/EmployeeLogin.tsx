import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { backendEmployeeLogin, registerEmployeePasskey } from "@/lib/backend";
import { setSession, setManagerSession } from "@/lib/storage";
import { getSettings } from "@/lib/storage";

const LOGIN_TIMEOUT_MS = 20000;
type EmployeeLoginUser = { id?: string; jobNumber?: string; username?: string; name?: string; status?: string; role?: string };

export default function EmployeeLogin() {
  const nav = useNavigate();
  const settings = getSettings();
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    let timer = 0;
    try {
      setManagerSession(null);
      const timeout = new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("انتهت مهلة الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.")), LOGIN_TIMEOUT_MS); });
      const rawUser = await Promise.race([backendEmployeeLogin(jobNumber.trim(), pin), timeout]) as EmployeeLoginUser;
      const employeeId = String(rawUser?.id || "").trim();
      const employeeJobNumber = String(rawUser?.jobNumber || rawUser?.username || "").trim();
      if (!employeeId || !employeeJobNumber) throw new Error("تعذر العثور على ملف الموظف المرتبط بهذا الحساب.");
      if (rawUser.status && rawUser.status !== "active") throw new Error("حساب الموظف موقوف. يرجى مراجعة الإدارة.");
      setSession({ employeeId, jobNumber: employeeJobNumber, name: String(rawUser.name || "").trim(), loginAt: new Date().toISOString(), role: rawUser.role || "staff" });
      window.dispatchEvent(new Event("hadir:session-changed"));
      try { await registerEmployeePasskey(); } catch { /* optional durable device anchor */ }
      nav("/employee", { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "تعذر تسجيل الدخول. حاول مرة أخرى.");
    } finally { if (timer) window.clearTimeout(timer); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="max-w-xl w-full mx-auto px-5 pt-6">
        <div className="flex items-center justify-between">
          <Brand />
          <Link to="/" className="btn-ghost text-xs">الرئيسية</Link>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-5 py-10">
        <section className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/12 border border-primary/25 grid place-items-center text-primary text-2xl font-black shadow-sm">H</div>
            <div className="text-xs text-muted-foreground font-semibold">{settings.brandName || "HADIR"} · بوابة الموظفين</div>
            <h1 className="text-3xl font-black tracking-tight mt-2">أهلاً بك</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-6">سجّل الدخول لعرض دوامك وتسجيل الحضور والانصراف بأمان.</p>
          </div>

          <div className="hud-card p-5 sm:p-6 shadow-sm">
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-bold mb-2">الرقم الوظيفي</span>
                <input type="text" inputMode="numeric" autoComplete="username" className="input w-full p-3.5 rounded-2xl border border-border bg-secondary/45 text-base" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} placeholder="مثال: 1001" required disabled={loading}/>
              </label>
              <label className="block">
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold">رمز الدخول</span><span className="text-[11px] text-muted-foreground">PIN</span></div>
                <input type="password" inputMode="numeric" autoComplete="current-password" className="input w-full p-3.5 rounded-2xl border border-border bg-secondary/45 text-base tracking-[0.3em]" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" required disabled={loading}/>
              </label>
              {err&&<div role="alert" className="rounded-2xl border border-destructive/35 bg-destructive/10 text-destructive-foreground p-3.5 text-sm leading-6">{err}</div>}
              <button className="btn-primary w-full py-3.5 rounded-2xl font-extrabold text-base" disabled={loading}>{loading?"جاري التحقق…":"تسجيل الدخول"}</button>
            </form>

            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-secondary/35 p-3"><div className="text-sm">🔐</div><div className="text-[11px] font-semibold mt-1">حماية الجهاز</div></div>
              <div className="rounded-2xl bg-secondary/35 p-3"><div className="text-sm">📍</div><div className="text-[11px] font-semibold mt-1">تحقق الموقع</div></div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-4 leading-5">عند أول دخول يتم ربط الجهاز بالحساب وفق سياسة الأمان. قد يُطلب إنشاء مفتاح مرور على الهاتف.</p>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs">
            <Link to="/" className="text-muted-foreground hover:text-foreground">← العودة</Link>
            <Link to="/manager/login" className="text-primary hover:underline font-semibold">دخول الإدارة</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
