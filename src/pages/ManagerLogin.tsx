import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { getSettings, setManagerSession } from "@/lib/storage";
import { hash } from "@/lib/hash";

export default function ManagerLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const settings = getSettings();
      const hashedPw = hash(pw);
      let matchedRole = "";
      let matchedName = "";

      // التحقق من حساب المالك
      if (
        username === (settings.ownerUsername || "owner") &&
        hashedPw === settings.ownerPasswordHash
      ) {
        matchedRole = "owner";
        matchedName = settings.ownerName || "المالك";
      }
      // التحقق من حساب المدير
      else if (
        username === (settings.managerUsername || "manager") &&
        hashedPw === settings.managerPasswordHash
      ) {
        matchedRole = "manager";
        matchedName = settings.managerName || "مدير عام";
      }
      // التحقق من حساب المشرف
      else if (
        username === (settings.supervisorUsername || "supervisor") &&
        hashedPw === settings.supervisorPasswordHash
      ) {
        matchedRole = "supervisor";
        matchedName = settings.supervisorName || "المشرف";
      }

      if (matchedRole) {
        // حفظ جلسة المدير/الإداري بنجاح
        setManagerSession({
          loginAt: new Date().toISOString(),
          name: matchedName,
          role: matchedRole,
        });
        localStorage.setItem("managerAuth", "true");
        navigate("/manager");
      } else {
        setErr("اسم المستخدم أو كلمة المرور غير صحيحة");
      }
    } catch (error) {
      console.error("Manager login error:", error);
      setErr("حدث خطأ أثناء محاولة تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-5">
        <Brand />
      </header>
      <main className="flex-1 grid place-items-center px-5 pb-10">
        <div className="w-full max-w-md hud-card p-7">
          <div className="text-xs mono text-muted-foreground">MANAGER · لوحة التحكم</div>
          <h1 className="text-2xl font-extrabold mt-1">دخول النظام</h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدخل اسم المستخدم وكلمة المرور للوصول لصلاحيات الإدارة (مالك، مدير، مشرف).
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                className="input w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">كلمة المرور</label>
              <input
                type="password"
                className="input w-full"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>

            {err && (
              <div
                className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive-foreground p-3 text-sm"
                role="alert"
              >
                {err}
              </div>
            )}
            <button className="btn-primary w-full py-3" disabled={loading}>
              {loading ? "جاري التحقق..." : "دخول"}
            </button>
          </form>
          <div className="mt-5 text-xs text-center">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← العودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
