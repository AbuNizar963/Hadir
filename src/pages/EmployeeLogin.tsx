import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { loginEmployee } from "@/lib/auth";

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    // Keep the UI responsive while avoiding an accidental double submit.
    window.setTimeout(() => {
      const result = loginEmployee(jobNumber, pin);
      setLoading(false);

      if (!result.success) {
        setError(result.reason || "الرقم الوظيفي أو رمز الدخول غير صحيح");
        return;
      }

      navigate("/employee", { replace: true });
    }, 150);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-5">
        <Brand />
      </header>

      <main className="flex-1 grid place-items-center px-5 pb-10">
        <div className="w-full max-w-md hud-card p-7">
          <div className="text-xs mono text-muted-foreground">EMPLOYEE · حاضِر</div>
          <h1 className="text-2xl font-extrabold mt-1">دخول الموظفين</h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدخل الرقم الوظيفي ورمز الدخول الخاص بك.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="jobNumber">
                الرقم الوظيفي
              </label>
              <input
                id="jobNumber"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                className="input w-full"
                value={jobNumber}
                onChange={(event) => setJobNumber(event.target.value)}
                placeholder="مثال: 1001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="pin">
                رمز الدخول
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className="input w-full"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="أدخل رمز الدخول"
                required
              />
            </div>

            {error && (
              <div
                className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive-foreground p-3 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? "جاري التحقق..." : "دخول الموظف"}
            </button>
          </form>

          <div className="mt-5 text-xs text-center flex justify-between items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← العودة للرئيسية
            </Link>
            <Link to="/manager/login" className="text-primary hover:underline">
              دخول الإدارة
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
