import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";
import { backendMe, bootstrapBackend, backendEnabled } from "@/lib/backend";
import { setManagerSession } from "@/lib/storage";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const session = currentManager();
  const [checking, setChecking] = useState(backendEnabled);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!backendEnabled) {
      setChecking(false);
      return;
    }

    let alive = true;

    const run = async () => {
      if (!session) {
        try {
          const b = await bootstrapBackend();
          if (!alive) return;
          setManagerSession({
            loginAt: new Date().toISOString(),
            name: "إعداد النظام",
            role: "owner",
            jobNumber: "",
            accountId: "bootstrap",
          });
          setFailed(false);
          setChecking(false);
          return b;
        } catch {
          if (alive) {
            setFailed(true);
            setChecking(false);
          }
          return;
        }
      }

      // A stored manager session is authoritative for the local UI.
      // A temporary Worker/network failure must NEVER log the user out.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const me = await backendMe();
          if (!alive) return;
          if (me.user?.role && ["owner", "manager", "supervisor"].includes(me.user.role)) {
            setFailed(false);
            setChecking(false);
            return;
          }
        } catch {
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
            continue;
          }
          // Keep the saved session. The next protected API request can recover
          // when Cloudflare becomes reachable again. Only explicit logout clears it.
          if (alive) {
            setFailed(false);
            setChecking(false);
          }
          return;
        }
      }

      if (alive) {
        setFailed(false);
        setChecking(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, []);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm">جاري التحقق من جلسة حاضر…</div>;
  }

  const active = currentManager();
  if (failed || !active || !active.role || !["owner", "manager", "supervisor"].includes(active.role)) {
    return <Navigate to="/manager/login" replace />;
  }

  return <>{children}</>;
}
