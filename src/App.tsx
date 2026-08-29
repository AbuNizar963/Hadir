import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { currentManager, currentSession } from "@/lib/auth";
import { setManagerSession, setSession } from "@/lib/storage";
import { enableWebPush } from "@/lib/push";
import type { Employee, AdminAccount } from "@/types";

const ManagerOnly = ({ children }: { children: React.ReactNode }) => <ProtectedManager>{children}</ProtectedManager>;
const EmployeeShell = ({ children }: { children: React.ReactNode }) => <ProtectedEmployee><EmployeeLayout>{children}</EmployeeLayout></ProtectedEmployee>;
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

type Role = "admin" | "employee";
type User = AdminAccount | Employee;

function PushSessionBridge() {
  const location = useLocation();
  const manager = currentManager();
  useEffect(() => {
    if (!location.pathname.startsWith("/manager") || location.pathname === "/manager/login" || !manager?.accountId) return;
    const key = `hadir.push.manager.${manager.accountId}`;
    if (sessionStorage.getItem(key) === "enabled") return;
    void enableWebPush(String(manager.accountId)).then(result => {
      if (result === "enabled") sessionStorage.setItem(key, "enabled");
    });
  }, [location.pathname, manager?.accountId]);
  return null;
}

type LaunchState = "checking" | "landing" | "employee" | "manager";

async function validateStoredToken(role: Role, token: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/api/me`, { method: "GET", headers: { authorization: `Bearer ${token}` }, credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({})) as { user?: User };
    const user = data.user;
    if (!user || typeof user !== "object") return null;
    if (role === "admin" && !["owner", "manager", "supervisor"].includes(String((user as AdminAccount).role))) return null;
    if (role === "employee" && String((user as Employee).role) !== "staff") return null;
    return user;
  } catch {
    return null;
  }
}

function LaunchGateway() {
  const [state, setState] = useState<LaunchState>(() => {
    if (currentManager()) return "manager";
    if (currentSession()) return "employee";
    return "checking";
  });

  useEffect(() => {
    if (state !== "checking") return;
    let alive = true;
    const restore = async () => {
      if (typeof window === "undefined") return;
      const adminToken = localStorage.getItem("hadir.api.token.admin")?.trim() || "";
      const employeeToken = localStorage.getItem("hadir.api.token.employee")?.trim() || "";
      if (!adminToken && !employeeToken) { if (alive) setState("landing"); return; }
      const candidates: Array<[Role, string]> = adminToken ? [["admin", adminToken]] : [["employee", employeeToken]];
      for (const [role, token] of candidates) {
        const user = await validateStoredToken(role, token);
        if (!alive) return;
        if (!user) continue;
        if (role === "admin") {
          const admin = user as AdminAccount;
          setManagerSession({ loginAt: currentManager()?.loginAt || new Date().toISOString(), name: admin.name, role: admin.role, jobNumber: admin.username, accountId: admin.id });
          setState("manager");
          return;
        }
        const employee = user as Employee;
        setSession({ employeeId: employee.id, jobNumber: employee.jobNumber, name: employee.name, loginAt: currentSession()?.loginAt || new Date().toISOString(), role: employee.role });
        setState("employee");
        return;
      }
      if (alive) setState("landing");
    };
    void restore();
    return () => { alive = false; };
  }, [state]);

  if (state === "checking") return <div dir="rtl" className="min-h-screen grid place-items-center bg-background px-6"><div className="text-center"><div className="text-3xl">🔐</div><p className="mt-3 font-bold">جاري استعادة جلسة الدخول…</p></div></div>;
  if (state === "employee") return <Navigate to="/employee" replace />;
  if (state === "manager") return <Navigate to="/manager" replace />;
  return <Landing />;
}

export default function App() {
  return <BrowserRouter basename={basename}>
    <PushSessionBridge />
    <Routes>
      <Route path="/" element={<LaunchGateway />} />
      <Route path="/login" element={<EmployeeLogin />} />
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
      <Route path="/manager/login" element={<ManagerLogin />} />
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
