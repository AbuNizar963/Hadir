import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";
import { backendMe, bootstrapBackend, backendEnabled } from "@/lib/backend";
import { setManagerSession } from "@/lib/storage";

const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const ADMIN_ROLES = ["owner", "manager", "supervisor"] as const;

type AdminRole = typeof ADMIN_ROLES[number];

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(backendEnabled);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      if (!backendEnabled) {
        const local = currentManager();
        if (alive) { setAuthorized(Boolean(local?.role && ADMIN_ROLES.includes(local.role as AdminRole))); setChecking(false); }
        return;
      }

      const local = currentManager();
      const token = typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;

      if (!local && !token) {
        try {
          const bootstrap = await bootstrapBackend();
          if (!alive) return;
          if (bootstrap.bootstrap) {
            setManagerSession({ loginAt: new Date().toISOString(), name: "إعداد النظام", role: "owner", jobNumber: "", accountId: "bootstrap" });
            setAuthorized(true);
          } else setAuthorized(false);
        } catch {
          if (alive) setAuthorized(false);
        } finally {
          if (alive) setChecking(false);
        }
        return;
      }

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const me = await backendMe();
          if (!alive) return;
          const role = me.user?.role;
          if (typeof role === "string" && ADMIN_ROLES.includes(role as AdminRole)) {
            const user = me.user as { id?: string; username?: string; name?: string; role?: string };
            setManagerSession({ loginAt: local?.loginAt || new Date().toISOString(), name: user.name, role, jobNumber: user.username, accountId: user.id });
            setAuthorized(true);
          } else {
            setAuthorized(false);
          }
          setChecking(false);
          return;
        } catch {
          if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
        }
      }

      if (alive) {
        // Network/Cloudflare failure is not a logout. Preserve the local session.
        setAuthorized(Boolean(local?.role && ADMIN_ROLES.includes(local.role as AdminRole)) || Boolean(token));
        setChecking(false);
      }
    };
    void restore();
    return () => { alive = false; };
  }, []);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-sm">جاري استعادة جلسة حاضر…</div>;
  if (!authorized) return <Navigate to="/manager/login" replace />;
  return <>{children}</>;
}
