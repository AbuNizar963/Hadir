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

  // Prefer the local bearer token when available, but always fall back to the
  // persistent HttpOnly session cookie. This is important for an installed
  // Chrome PWA, where localStorage and browser-tab storage can occasionally differ.
  let token = localStorage.getItem(EMPLOYEE_TOKEN_KEY)?.trim() || "";
  let networkFailure = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const headers: HeadersInit = {};
        if (token) headers.authorization = `Bearer ${token}`;
        const response = await fetch(`${API_URL}/api/me`, {
          method: "GET",
          credentials: "include",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as { user?: Employee; error?: string };

        if (response.status === 401 || response.status === 403) {
          if (token) {
            // Do not let an expired/stale local token block the persistent cookie.
            token = "";
            localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
            continue;
          }
          return "unauthorized";
        }

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
  const [checking, setChecking] = useState(!session);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (session) {
      setChecking(false);
      return () => { cancelled = true; };
    }

    void restoreEmployeeSession().then((result) => {
      if (cancelled) return;
      if (result === "restored") {
        setCurrentSession(currentSession());
        setOffline(false);
      } else if (result === "offline") {
        setOffline(true);
      }
      setChecking(false);
    });

    return () => { cancelled = true; };
  }, [session]);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">جاري استعادة جلسة الموظف…</div>;
  }

  if (!session) {
    if (offline && localStorage.getItem(EMPLOYEE_TOKEN_KEY)) {
      return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center">تعذر الاتصال بالخادم مؤقتًا. جلسة الموظف محفوظة، حاول فتح الصفحة مرة أخرى.</div>;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
