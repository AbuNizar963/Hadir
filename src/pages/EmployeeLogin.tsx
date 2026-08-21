import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { backendEmployeeLogin } from "@/lib/backend";
import { setSession, setManagerSession } from "@/lib/storage";
import { getSettings } from "@/lib/storage";

const LOGIN_TIMEOUT_MS = 20000;

export default function EmployeeLogin() {
  const nav = useNavigate();
  const settings = getSettings();
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => undefined, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setLoading(true);

    let timer = 0;
    try {
      setManagerSession(null);
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("انتهت مهلة الاتصال بخادم حاضر. تحقق من الإنترنت وحاول مرة أخرى.")), LOGIN_TIMEOUT_MS);
      });

      const employee = await Promise.race([backendEmployeeLogin(jobNumber, pin), timeout]);

      if (!employee?.id || !employee?.jobNumber) throw new Error("تعذر العثور على ملف الموظف المرتبط بهذا الحساب في D1.");
      if (employee.status && employee.status !== "active") throw new Error("حساب الموظف موقوف. يرجى مراجعة الإدارة.");

      setSession({ employeeId: employee.id, jobNumber: employee.jobNumber, name: employee.name, loginAt: new Date().toISOString(), role: employee.role });
      nav("/employee", { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "تعذر تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      if (timer) window.clearTimeout(timer);
      setLoading(false);
    }
  };

  return <div className="min-h-screen flex flex-col"><header className="p-5"><Brand /></header><main className="flex-1 grid place-items-center px-5 pb-10"><div className="w-full max-w-md hud-card p-7"><div className="text-xs mono text-muted-foreground">{settings.brandName || "HADIR"} · بوابة الموظفين</div><h1 className="text-2xl font-extrabold mt-1">تسجيل دخول الموظف</h1><p className="text-sm text-muted-foreground mt-1">أدخل رقمك الوظيفي ورمز الـ PIN الخاص بك للوصول لنظام الحضور.</p><form onSubmit={submit} className="mt-6 space-y-4"><div><label className="block text-sm font-semibold mb-1.5">الرقم الوظيفي</label><input type="text" className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} placeholder="مثال: 1001" required disabled={loading}/></div><div><label className="block text-sm font-semibold mb-1.5">رمز الـ PIN السري</label><input type="password" className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm" value={pin} onChange={e=>setPin(e.target.value)} placeholder="أدخل رمز الـ PIN" required disabled={loading}/></div>{err&&<div className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive-foreground p-3 text-sm">{err}</div>}<button className="btn-primary w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl" disabled={loading}>{loading?"جاري التحقق من D1...":"دخول الموظف"}</button></form><div className="mt-5 text-xs text-center flex justify-between items-center"><Link to="/" className="text-muted-foreground hover:text-foreground">← العودة للرئيسية</Link><Link to="/manager/login" className="text-primary hover:underline">دخول الإدارة ؟</Link></div></div></main></div>;
}
