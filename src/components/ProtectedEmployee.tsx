import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import { setSession } from "@/lib/storage";
import type { Employee } from "@/types";

const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";
const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

type Props = { children: React.ReactNode };
type RestoreResult = "restored" | "unauthorized" | "offline" | "missing";

async function restoreEmployeeSession(): Promise<RestoreResult> {
  if (typeof window === "undefined") return "missing";
  const token = localStorage.getItem(EMPLOYEE_TOKEN_KEY)?.trim() || "";
  if (!token) return "missing";

  let networkFailure = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${API_URL}/api/me`, {
          method: "GET",
          credentials: "include",
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as { user?: Employee; error?: string };
        if (response.status === 401 || response.status === 403) return "unauthorized";
        if (!response.ok || !data.user || typeof data.user.id !== "string") {
          networkFailure = true;
        } else {
          const employee = data.user;
          setSession({
            employeeId: employee.id,
            jobNumber: employee.jobNumber,
            name: employee.name,
            loginAt: currentSession()?.loginAt || new Date().toISOString(),
            role: employee.role,
          });
          return "restored";
        }
      } finally {
        window.clearTimeout(timeout);
      }
    } catch {
      networkFailure = true;
    }
    if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
  }

  return networkFailure ? "offline" : "missing";
}

export default function ProtectedEmployee({ children }: Props) {
  const [session, setCurrentSession] = useState(() => currentSession());
  const [checking, setChecking] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void restoreEmployeeSession().then((result) => {
      if (cancelled) return;
      if (result === "restored") {
        setCurrentSession(currentSession());
        setOffline(false);
      } else if (result === "unauthorized" || result === "missing") {
        localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
        setSession(null);
        setCurrentSession(null);
        setOffline(false);
      } else {
        // Never convert a temporary Cloudflare/network outage into a logout.
        // If a local session exists, keep the employee UI available until the server can be reached.
        setOffline(true);
      }
      setChecking(false);
    });

    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">جاري التحقق من جلسة الموظف…</div>;
  }

  if (!session) {
    if (offline && localStorage.getItem(EMPLOYEE_TOKEN_KEY)) {
      return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center">تعذر الاتصال بالخادم مؤقتًا. جلسة الموظف محفوظة، حاول فتح الصفحة مرة أخرى.</div>;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
