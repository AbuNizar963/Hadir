import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import { setSession } from "@/lib/storage";
import type { Employee } from "@/types";

const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";
const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

type Props = { children: React.ReactNode };

async function restoreEmployeeSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem(EMPLOYEE_TOKEN_KEY);
  if (!token) return false;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${API_URL}/api/me`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as { user?: Employee };
        if (!response.ok || !data.user || typeof data.user.id !== "string") return false;
        const employee = data.user;
        setSession({
          employeeId: employee.id,
          jobNumber: employee.jobNumber,
          name: employee.name,
          loginAt: new Date().toISOString(),
          role: employee.role,
        });
        return true;
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
    }
  }

  // A temporary network/Cloudflare failure must never destroy the saved session.
  void lastError;
  return false;
}

export default function ProtectedEmployee({ children }: Props) {
  const [session, setCurrentSession] = useState(() => currentSession());
  const [checking, setChecking] = useState(!session);

  useEffect(() => {
    let cancelled = false;
    if (session) {
      setChecking(false);
      return () => { cancelled = true; };
    }

    void restoreEmployeeSession().then((restored) => {
      if (cancelled) return;
      if (restored) setCurrentSession(currentSession());
      // Do not clear tokens or create a logout state because the server is temporarily unreachable.
      setChecking(false);
    });

    return () => { cancelled = true; };
  }, [session]);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">جاري استعادة جلسة الموظف…</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
