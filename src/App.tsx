import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLogin from "@/features/auth/employee/EmployeeLogin";
import EmployeeHome from "@/pages/EmployeeHome";
import EmployeeHistory from "@/pages/EmployeeHistory";
import EmployeeScanAutoFlow from "@/pages/EmployeeScanAutoFlow";
import EmployeeProfile from "@/pages/EmployeeProfile";
import EmployeeCenter from "@/pages/EmployeeCenter";
import EmployeeNotifications from "@/pages/EmployeeNotifications";
import WeatherPage from "@/pages/WeatherPage";
import PrayerPage from "@/pages/PrayerPage";
import AIAssistant from "@/pages/AIAssistant";
import ManagerLogin from "@/pages/ManagerLogin";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ManagerEmployees from "@/pages/ManagerEmployees";
import ManagerWorkforceControls from "@/pages/ManagerWorkforceControls";
import ManagerRequests from "@/pages/ManagerRequests";
import ManagerAudit from "@/pages/ManagerAudit";
import ManagerSettings from "@/pages/ManagerSettings";
import ManagerReports from "@/pages/ManagerReports";
import EmployeeLayout from "@/components/layout/EmployeeLayout";
import NotFound from "@/pages/NotFound";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";
import RequireManagerRole from "@/components/RequireManagerRole";
import SessionRedirect from "@/components/SessionRedirect";
import { getManagerSession, setManagerSession, setSession } from "@/lib/storage";
import { backendMe } from "@/lib/backend";
import { getLastPwaRole, restorePwaSession } from "@/lib/pwaSession";
import { enableWebPush } from "@/lib/push";

const ManagerOnly = ({ children }: { children: React.ReactNode }) => <ProtectedManager>{children}</ProtectedManager>;
const EmployeeShell = ({ children }: { children: React.ReactNode }) => <ProtectedEmployee><EmployeeLayout>{children}</EmployeeLayout></ProtectedEmployee>;
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

function PushSessionBridge() {
  const location = useLocation();
  const manager = getManagerSession();
  useEffect(() => {
    if (!location.pathname.startsWith("/manager") || location.pathname === "/manager/login" || !manager?.accountId) return;
    const key = `hadir.push.manager.${manager.accountId}`;
    if (sessionStorage.getItem(key) === "enabled") return;
    void enableWebPush(String(manager.accountId)).then((result) => {
      if (result === "enabled") sessionStorage.setItem(key, "enabled");
    });
  }, [location.pathname, manager?.accountId]);
  return null;
}

function PwaEntry() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      let result: any = null;
      const lastRole = getLastPwaRole();
      const roles: Array<"employee" | "admin"> = lastRole
        ? [lastRole, lastRole === "admin" ? "employee" : "admin"]
        : ["employee", "admin"];

      // The installed PWA can have its own durable storage context. Always
      // consult the role-specific PWA credential before allowing the landing
      // page or login screen to render.
      for (const role of roles) {
        try {
          result = await restorePwaSession(role);
          if (result?.user) break;
        } catch {
          result = null;
        }
      }

      // Keep the normal bearer-token path as a second recovery source. This
      // also covers an existing browser session that predates PWA persistence.
      if (!result?.user) {
        try {
          result = await backendMe(lastRole);
        } catch {
          result = null;
        }
      }

      if (cancelled) return;

      const user = result?.user as {
        id?: string;
        username?: string;
        jobNumber?: string;
        name?: string;
        role?: string;
      } | undefined;
      const role = String(user?.role || "").toLowerCase();

      if (["employee", "staff"].includes(role) && user?.id) {
        setManagerSession(null);
        setSession({
          employeeId: String(user.id),
          jobNumber: String(user.jobNumber || user.username || ""),
          name: String(user.name || ""),
          loginAt: new Date().toISOString(),
          role: user.role || "staff",
        });
        navigate("/employee", { replace: true });
        return;
      }

      if (["owner", "manager", "supervisor", "admin"].includes(role) && user?.id) {
        setSession(null);
        setManagerSession({
          loginAt: new Date().toISOString(),
          name: user.name,
          role: role as "owner" | "manager" | "supervisor",
          jobNumber: user.username,
          accountId: user.id,
        });
        navigate("/manager", { replace: true });
        return;
      }

      setChecking(false);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center">جاري استعادة جلسة الدخول…</div>;
  }

  return <Landing />;
}

export default function App() {
  return <BrowserRouter basename={basename}>
    <PushSessionBridge />
    <Routes>
      <Route path="/" element={<PwaEntry />} />
      <Route path="/login" element={<SessionRedirect expected="employee"><EmployeeLogin /></SessionRedirect>} />
      <Route path="/weather" element={<WeatherPage />} />
      <Route path="/prayer" element={<PrayerPage />} />
      <Route path="/ai" element={<AIAssistant />} />
      <Route path="/employee" element={<EmployeeShell><EmployeeHome /></EmployeeShell>} />
      <Route path="/employee/center" element={<EmployeeShell><EmployeeCenter /></EmployeeShell>} />
      <Route path="/employee/premium" element={<Navigate to="/employee/center" replace />} />
      <Route path="/employee/profile" element={<EmployeeShell><EmployeeProfile /></EmployeeShell>} />
      <Route path="/employee/history" element={<EmployeeShell><EmployeeHistory /></EmployeeShell>} />
      <Route path="/employee/notifications" element={<EmployeeShell><EmployeeNotifications /></EmployeeShell>} />
      <Route path="/employee/scan/:type" element={<EmployeeShell><EmployeeScanAutoFlow /></EmployeeShell>} />
      <Route path="/manager/login" element={<SessionRedirect expected="manager"><ManagerLogin /></SessionRedirect>} />
      <Route path="/manager" element={<ManagerOnly><ManagerDashboard /></ManagerOnly>} />
      <Route path="/manager/employees" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager", "supervisor"]}><ManagerEmployees /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/workforce" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager", "supervisor"]}><ManagerWorkforceControls /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/requests" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager"]}><ManagerRequests /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/audit" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager", "supervisor"]}><ManagerAudit /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/reports" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager"]}><ManagerReports /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/settings" element={<ManagerOnly><RequireManagerRole roles={["owner"]}><ManagerSettings /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager-home" element={<Navigate to="/manager" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>;
}
