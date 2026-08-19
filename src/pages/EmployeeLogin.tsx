import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { loginEmployee } from "@/lib/auth";
import { getSettings } from "@/lib/storage";

export default function EmployeeLogin() {
  const nav = useNavigate();
  const settings = getSettings();
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    setTimeout(() => {
      const res = loginEmployee(jobNumber, pin);
      setLoading(false);

      if (!res.success) {
        setErr(res.error || "الرقم الوظيفي أو رمز الـ PIN غير صحيح");
      } else {
        nav("/employee");
      }
    }, 250);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-5">
        <Brand />
      </header>
      <main className="flex-1 grid place-items-center px-5 pb-10">
        <div className="w-full max-w-md hud-card p-7">
          <div className="text-xs mono text-muted-foreground">{settings.brandName || "HADIR"} · بوابة الموظفين</div>
          <h1 className="text-2xl font-extrabold mt-1">تسجيل دخول الموظف</h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدخل رقمك الوظيفي ورمز الـ PIN الخاص بك للوصول لنظام الحضور.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">الرقم الوظيفي</label>
              <input
                type="text"
                className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                placeholder="مثال: 1001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">رمز الـ PIN السري</label>
              <input
                type="password"
                className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="أدخل رمز الـ PIN"
                required
              />
            </div>

            {err && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive-foreground p-3 text-sm">
                {err}
              </div>
            )}
            <button className="btn-primary w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl" disabled={loading}>
              {loading ? "جاري التحقق..." : "دخول الموظف"}
            </button>
          </form>
          <div className="mt-5 text-xs text-center flex justify-between items-center">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← العودة للرئيسية
            </Link>
            <Link to="/manager/login" className="text-primary hover:underline">
              دخول الإدارة ؟
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
