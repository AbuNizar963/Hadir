import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { backendEnabled, backendEmployeeLogin } from "@/lib/backend";
import { setSession } from "@/lib/storage";
import type { Employee } from "@/types";

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const normalizedJobNumber = jobNumber.trim();
    const normalizedPin = pin.trim();
    if (!normalizedJobNumber || !normalizedPin) {
      setError("أدخل الرقم الوظيفي ورمز الدخول.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!backendEnabled) throw new Error("خدمة تسجيل دخول الموظفين غير مفعلة. تحقق من إعداد Cloudflare Worker.");
      const employee = await backendEmployeeLogin(normalizedJobNumber, normalizedPin);
      const session: Employee = employee;
      if (!session?.id || session.jobNumber !== normalizedJobNumber) {
        throw new Error("تعذر تأكيد هوية الموظف من D1. لم يتم فتح جلسة ناقصة.");
      }
      setSession({ employeeId: session.id, jobNumber: session.jobNumber, name: session.name, loginAt: new Date().toISOString(), role: session.role });
      window.dispatchEvent(new Event("hadir:session-changed"));
      navigate("/employee", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر تسجيل الدخول";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-5"><Brand /></header>
      <main className="flex-1 grid place-items-center px-5 pb-10">
        <div className="w-full max-w-md hud-card p-7">
          <div className="text-xs mono text-muted-foreground">EMPLOYEE · حاضِر</div>
          <h1 className="text-2xl font-extrabold mt-1">دخول الموظفين</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل الرقم الوظيفي ورمز الدخول الخاص بك.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div><label className="block text-sm text-semibold mb-1.5" htmlFor="employee-job-number">الرقم الوظيفي</label><input id="employee-job-number" name="username" className="input w-full" value={jobNumber} onChange={e => setJobNumber(e.target.value)} autoComplete="username" inputMode="text" required /></div>
            <div><label className="block text-sm font-semibold mb-1.5" htmlFor="employee-pin">رمز الدخول</label><input id="employee-pin" name="password" className="input w-full" type="password" value={pin} onChange={e => setPin(e.target.value)} autoComplete="current-password" inputMode="numeric" required /></div>
            {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">{error}</div>}
            <button type="submit" className="btn-primary w-full py-3" disabled={loading} aria-busy={loading}>{loading ? "جاري التحقق..." : "دخول الموظف"}</button>
          </form>
          <div className="mt-5 text-xs text-center flex justify-between"><Link to="/">← العودة للرئيسية</Link><Link to="/manager/login">دخول الإدارة</Link></div>
        </div>
      </main>
    </div>
  );
}