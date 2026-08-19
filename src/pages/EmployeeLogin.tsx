import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { loginManager } from "@/lib/auth";

export default function ManagerLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    setTimeout(() => {
      // نمرر كلمة المرور واسم المستخدم (إن وجد) للدالة المحدثة
      const res = loginManager(password, username);
      setLoading(false);

      if (!res.success) {
        setErr(res.reason || "اسم المستخدم أو كلمة المرور غير صحيحة");
      } else {
        nav("/manager"); // توجيه لوحة التحكم
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
          <div className="text-xs mono text-muted-foreground">بوابة الإدارة والتحكم</div>
          <h1 className="text-2xl font-extrabold mt-1">تسجيل دخول الإدارة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدخل اسم المستخدم وكلمة المرور الخاصة بحسابك (المالك، المدير، أو المشرف).
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            
            {/* حقل اسم المستخدم الجديد */}
            <div>
              <label className="block text-sm font-semibold mb-1.5">اسم المستخدم (اختياري أو محدد)</label>
              <input
                type="text"
                className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: owner, manager, supervisor"
              />
            </div>

            {/* حقل كلمة المرور */}
            <div>
              <label className="block text-sm font-semibold mb-1.5">كلمة المرور</label>
              <input
                type="password"
                className="input w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>

            {err && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive-foreground p-3 text-sm">
                {err}
              </div>
            )}
            
            <button className="btn-primary w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl" disabled={loading}>
              {loading ? "جاري التحقق..." : "دخول الإدارة"}
            </button>
          </form>

          <div className="mt-5 text-xs text-center flex justify-between items-center">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← العودة للرئيسية
            </Link>
            <Link to="/login" className="text-primary hover:underline">
              دخول الموظفين ؟
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
