import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { backendMe } from "@/lib/backend";
import { restorePwaSession } from "@/lib/pwaSession";
import { setManagerSession, setSession } from "@/lib/storage";

type Props = { children: React.ReactNode; expected: "employee" | "manager" };

function applyUser(user: any, expected: Props["expected"], navigate: ReturnType<typeof useNavigate>) {
  const role = String(user?.role || "").toLowerCase();
  if (expected === "employee" && ["employee", "staff"].includes(role) && user?.id) {
    setManagerSession(null);
    setSession({ employeeId: String(user.id), jobNumber: String(user.jobNumber || user.username || ""), name: String(user.name || ""), loginAt: new Date().toISOString(), role: user.role || "staff" });
    navigate("/employee", { replace: true });
    return true;
  }
  if (expected === "manager" && ["owner", "manager", "supervisor", "admin"].includes(role) && user?.id) {
    setSession(null);
    setManagerSession({ loginAt: new Date().toISOString(), name: user.name, role: role as "owner" | "manager" | "supervisor", jobNumber: user.username, accountId: user.id });
    navigate("/manager", { replace: true });
    return true;
  }
  return false;
}

export default function SessionRedirect({ children, expected }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const attempts = [backendMe, async () => restorePwaSession()];
      for (const attempt of attempts) {
        try {
          const result = await attempt();
          if (cancelled) return;
          if (applyUser(result?.user, expected, navigate)) return;
          if (result?.user) break;
        } catch {
          // Try the next persistent session source before showing login.
        }
      }
      if (!cancelled) setChecking(false);
    };
    void check();
    return () => { cancelled = true; };
  }, [expected, location.pathname, navigate]);

  if (checking) {
    return <div dir="rtl" className="min-h-screen grid place-items-center p-6 text-center">جاري التحقق من جلسة الدخول…</div>;
  }
  return <>{children}</>;
}
