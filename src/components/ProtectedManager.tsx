import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { currentManager, currentSession } from "@/lib/auth";
import { backendMe, bootstrapBackend, backendEnabled } from "@/lib/backend";
import { setManagerSession } from "@/lib/storage";

const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";
const ADMIN_ROLES = ["owner", "manager", "supervisor"] as const;

type AdminRole = typeof ADMIN_ROLES[number];
type AccessState = "checking" | "authorized" | "employee" | "unauthorized";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AccessState>(backendEnabled ? "checking" : "unauthorized");

  useEffect(() => {
    let alive = true;

    const restore = async () => {
      const employeeSession = currentSession();
      const employeeToken = typeof window !== "undefined" ? localStorage.getItem(EMPLOYEE_TOKEN_KEY) : null;
      const adminToken = typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;

      // الموظف المسجل محلياً لا يجب أن يرى صفحة تسجيل دخول الإدارة عند فتح رابط إداري.
      if (employeeSession && !adminToken) {
        if (alive) setState("employee");
        return;
      }

      if (!backendEnabled) {
        const local = currentManager();
        if (alive) {
          setState(local?.role && ADMIN_ROLES.includes(local.role as AdminRole) ? "authorized" : employeeSession ? "employee" : "unauthorized");
        }
        return;
      }

      const local = currentManager();
      const token = adminToken;

      // لا توجد جلسة إدارة: تحقّق أولاً من جلسة الموظف قبل إعادة التوجيه.
      if (!local && !token) {
        if (employeeSession || employeeToken) {
          if (alive) setState("employee");
          return;
        }

        try {
          const bootstrap = await bootstrapBackend();
          if (!alive) return;
          if (bootstrap.bootstrap) {
            setManagerSession({
              loginAt: new Date().toISOString(),
              name: "إعداد النظام",
              role: "owner",
              jobNumber: "",
              accountId: "bootstrap",
            });
            setState("authorized");
          } else {
            setState("unauthorized");
          }
        } catch {
          if (alive) setState("unauthorized");
        }
        return;
      }

      // تحقّق من هوية الحساب من الخادم. إذا كان Staff فهو موظف وليس مديراً.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const me = await backendMe();
          if (!alive) return;

          const role = me.user?.role;
          if (typeof role === "string" && ADMIN_ROLES.includes(role as AdminRole)) {
            const user = me.user as {
              id?: string;
              username?: string;
              name?: string;
              role?: string;
            };

            setManagerSession({
              loginAt: local?.loginAt || new Date().toISOString(),
              name: user.name,
              role,
              jobNumber: user.username,
              accountId: user.id,
            });
            setState("authorized");
          } else {
            setState("employee");
          }
          return;
        } catch {
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
          }
        }
      }

      if (alive) {
        // فشل الشبكة لا يعني تسجيل الخروج. نحافظ على الجلسة المحلية الحالية.
        if (local?.role && ADMIN_ROLES.includes(local.role as AdminRole)) {
          setState("authorized");
        } else if (employeeSession || employeeToken) {
          setState("employee");
        } else {
          setState(Boolean(token) ? "authorized" : "unauthorized");
        }
      }
    };

    void restore();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl">🔐</div>
          <h1 className="text-lg font-black">جاري التحقق من صلاحية الدخول…</h1>
          <p className="mt-2 text-sm text-muted-foreground">يرجى الانتظار لحظات.</p>
        </div>
      </div>
    );
  }

  if (state === "employee") {
    return (
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <section className="w-full max-w-lg">
            <div className="rounded-3xl border border-primary/20 bg-card p-6 shadow-xl sm:p-8">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-primary/20 bg-primary/10 text-4xl">🔒</div>

              <div className="mt-6 text-center">
                <div className="mono text-xs font-bold tracking-widest text-primary">HADIR · ACCESS CONTROL</div>
                <h1 className="mt-2 text-2xl font-black">هذه الواجهة مخصصة للإدارة</h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                  أنت مسجل الدخول حالياً كموظف، ولا تملك صلاحية الوصول إلى واجهة الإدارة.
                </p>
              </div>

              <div className="mt-6 rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">👤</div>
                  <div className="min-w-0">
                    <div className="font-bold">انتقل إلى واجهة دخول الموظفين</div>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      استخدم واجهة الموظفين للوصول إلى الحضور والطلبات والملف الشخصي وباقي خدمات الموظف.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button type="button" className="btn-primary min-h-11" onClick={() => navigate("/employee", { replace: true })}>
                  الانتقال إلى واجهة الموظفين
                </button>
                <button type="button" className="btn-secondary min-h-11" onClick={() => navigate("/login", { replace: true })}>
                  تسجيل دخول الموظفين
                </button>
              </div>

              <p className="mt-5 text-center text-[11px] text-muted-foreground">
                إذا كنت من الإدارة، قم بتسجيل الخروج من حساب الموظف ثم استخدم حساب الإدارة.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (state === "unauthorized") {
    return <Navigate to="/manager/login" replace />;
  }

  return <>{children}</>;
}
