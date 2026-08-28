import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import { backendMe, backendEnabled } from "@/lib/backend";
import { setSession } from "@/lib/storage";
import type { Employee } from "@/types";

type Props = { children: React.ReactNode };
type RestoreResult = "restored" | "unauthorized" | "offline";

async function restoreEmployeeSession(): Promise<RestoreResult> {
  if (!backendEnabled) return currentSession() ? "restored" : "unauthorized";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await backendMe();
      const employee = result.user as Employee;
      if (!employee || typeof employee.id !== "string" || employee.role !== "employee") return "unauthorized";

      setSession({
        employeeId: employee.id,
        jobNumber: employee.jobNumber,
        name: employee.name,
        loginAt: currentSession()?.loginAt || new Date().toISOString(),
        role: employee.role,
      });
      return "restored";
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const unauthorized = message.includes("401") || message.includes("403") || message.includes("غير مصرح");
      if (unauthorized) return "unauthorized";
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
    }
  }

  return "offline";
}

export default function ProtectedEmployee({ children }: Props) {
  const [session, setCurrentSession] = useState(() => currentSession());
  const [checking, setChecking] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void restoreEmployeeSession().then((result) => {
      if (cancelled) return;
      const restored = currentSession();
      if (result === "restored" && restored) {
        setCurrentSession(restored);
        setOffline(false);
      } else if (result === "offline" && restored) {
        setCurrentSession(restored);
        setOffline(true);
      } else {
        setCurrentSession(null);
        setOffline(result === "offline");
      }
      setChecking(false);
    });

    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">جاري استعادة جلسة الموظف…</div>;
  }

  if (!session) {
    if (offline) {
      return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center">تعذر التحقق من جلسة الموظف حاليًا. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.</div>;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
