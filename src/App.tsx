import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLayout from "@/components/layout/EmployeeLayout";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";
import RequireManagerRole from "@/components/RequireManagerRole";
import PWAExperience from "@/components/system/PWAExperience";
import { currentManager, currentSession } from "@/lib/auth";
import { setManagerSession, setSession } from "@/lib/storage";
import { enableWebPush } from "@/lib/push";
import type { Employee, AdminAccount } from "@/types";
import { ToastProvider } from "@/components/system/ToastProvider";

const EmployeeLogin = lazy(
  () => import("@/features/auth/employee/EmployeeLogin"),
);
const EmployeeHome = lazy(() => import("@/pages/EmployeeHome"));
const EmployeeHistory = lazy(() => import("@/pages/EmployeeHistory"));
const EmployeeScanAutoFlow = lazy(() => import("@/pages/EmployeeScanAutoFlow"));
const EmployeeProfile = lazy(() => import("@/pages/EmployeeProfile"));
const EmployeeCenter = lazy(() => import("@/pages/EmployeeCenter"));
const EmployeeNotifications = lazy(
  () => import("@/pages/EmployeeNotifications"),
);
const WeatherPage = lazy(() => import("@/pages/WeatherPage"));
const PrayerPage = lazy(() => import("@/pages/PrayerPage"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const ManagerLogin = lazy(() => import("@/pages/ManagerLogin"));
const ManagerDashboard = lazy(() => import("@/pages/ManagerDashboard"));
const ManagerEmployees = lazy(() => import("@/pages/ManagerEmployees"));
const ManagerWorkforceControls = lazy(
  () => import("@/pages/ManagerWorkforceControls"),
);
const ManagerRequests = lazy(() => import("@/pages/ManagerRequests"));
const ManagerAudit = lazy(() => import("@/pages/ManagerAudit"));
const ManagerSettings = lazy(() => import("@/pages/ManagerSettings"));
const GlobalAttendanceReports = lazy(
  () => import("@/pages/GlobalAttendanceReports"),
);
const ReportArchive = lazy(() => import("@/pages/ReportArchive"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const ManagerOnly = ({ children }: { children: React.ReactNode }) => (
  <ProtectedManager>{children}</ProtectedManager>
);
const EmployeeShell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedEmployee>
    <EmployeeLayout>{children}</EmployeeLayout>
  </ProtectedEmployee>
);
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
const API_URL = String(
  import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev",
).replace(/\/$/, "");

type Role = "admin" | "employee";
type User = AdminAccount | Employee;
type TokenRestoreResult =
  | { status: "restored"; user: User }
  | { status: "invalid" | "transient" };

function RouteLoadingFallback() {
  return (
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-background px-6"
      role="status"
      aria-live="polite"
    >
      <p className="font-bold text-muted-foreground">جارٍ تحميل الصفحة…</p>
    </main>
  );
}

function PushSessionBridge() {
  const location = useLocation();
  const manager = currentManager();
  useEffect(() => {
    if (
      !location.pathname.startsWith("/manager") ||
      location.pathname === "/manager/login" ||
      !manager?.accountId
    )
      return;
    const key = `hadir.push.manager.${manager.accountId}`;
    if (sessionStorage.getItem(key) === "enabled") return;
    void enableWebPush(String(manager.accountId)).then((result) => {
      if (result === "enabled") sessionStorage.setItem(key, "enabled");
    });
  }, [location.pathname, manager?.accountId]);
  return null;
}

type LaunchState = "checking" | "landing" | "employee" | "manager" | "offline";

async function validateStoredToken(
  role: Role,
  token: string,
): Promise<TokenRestoreResult> {
  try {
    const response = await fetch(`${API_URL}/api/me`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      credentials: "include",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403)
      return { status: "invalid" };
    if (!response.ok) return { status: "transient" };
    const data = (await response.json().catch(() => null)) as {
      user?: User;
    } | null;
    const user = data?.user;
    if (!user || typeof user !== "object") return { status: "transient" };
    if (
      role === "admin" &&
      !["owner", "manager", "supervisor"].includes(
        String((user as AdminAccount).role),
      )
    )
      return { status: "invalid" };
    if (role === "employee" && String((user as Employee).role) !== "staff")
      return { status: "invalid" };
    return { status: "restored", user };
  } catch {
    return { status: "transient" };
  }
}

function LaunchGateway() {
  const [state, setState] = useState<LaunchState>(() => {
    if (currentManager()) return "manager";
    if (currentSession()) return "employee";
    return "checking";
  });

  useEffect(() => {
    if (state !== "checking" && state !== "offline") return;
    let alive = true;
    let retryTimer: number | undefined;

    const restore = async () => {
      if (typeof window === "undefined") return;
      const adminToken =
        localStorage.getItem("hadir.api.token.admin")?.trim() || "";
      const employeeToken =
        localStorage.getItem("hadir.api.token.employee")?.trim() || "";
      if (!adminToken && !employeeToken) {
        if (alive) setState("landing");
        return;
      }

      const candidates: Array<[Role, string]> = [];
      if (adminToken) candidates.push(["admin", adminToken]);
      if (employeeToken) candidates.push(["employee", employeeToken]);

      let transientFailure = false;
      for (const [role, token] of candidates) {
        const result = await validateStoredToken(role, token);
        if (!alive) return;
        if (result.status === "transient") transientFailure = true;
        if (result.status !== "restored") continue;

        if (role === "admin") {
          const admin = result.user as AdminAccount;
          setManagerSession({
            loginAt: currentManager()?.loginAt || new Date().toISOString(),
            name: admin.name,
            role: admin.role,
            jobNumber: admin.username,
            accountId: admin.id,
          });
          setState("manager");
          return;
        }

        const employee = result.user as Employee;
        setSession({
          employeeId: employee.id,
          jobNumber: employee.jobNumber,
          name: employee.name,
          loginAt: currentSession()?.loginAt || new Date().toISOString(),
          role: employee.role,
        });
        setState("employee");
        return;
      }

      if (!alive) return;
      if (transientFailure) {
        setState("offline");
        retryTimer = window.setTimeout(() => {
          if (alive) setState("checking");
        }, 3000);
        return;
      }

      setState("landing");
    };

    void restore();
    return () => {
      alive = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [state]);

  if (state === "checking")
    return (
      <div
        dir="rtl"
        className="min-h-screen grid place-items-center bg-background px-6"
      >
        <div className="text-center">
          <div className="text-3xl">🔐</div>
          <p className="mt-3 font-bold">جارٍ استعادة جلسة الدخول…</p>
          <p className="mt-2 text-sm text-muted-foreground">
            لن يتم تسجيل خروجك بسبب انقطاع مؤقت في الاتصال.
          </p>
        </div>
      </div>
    );
  if (state === "offline")
    return (
      <div
        dir="rtl"
        className="min-h-screen grid place-items-center bg-background px-6"
      >
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 text-center shadow-lg">
          <div className="text-3xl">📡</div>
          <p className="mt-3 font-bold">الجلسة محفوظة</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            الخادم غير متاح مؤقتًا. لم يتم حذف تسجيل الدخول، وستتم إعادة
            المحاولة تلقائيًا.
          </p>
        </div>
      </div>
    );
  if (state === "employee") return <Navigate to="/employee" replace />;
  if (state === "manager") return <Navigate to="/manager" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <PushSessionBridge />
      <PWAExperience />
      <ToastProvider />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<LaunchGateway />} />
          <Route path="/login" element={<EmployeeLogin />} />
          <Route path="/weather" element={<WeatherPage />} />
          <Route path="/prayer" element={<PrayerPage />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route
            path="/employee"
            element={
              <EmployeeShell>
                <EmployeeHome />
              </EmployeeShell>
            }
          />
          <Route
            path="/employee/center"
            element={
              <EmployeeShell>
                <EmployeeCenter />
              </EmployeeShell>
            }
          />
          <Route
            path="/employee/premium"
            element={<Navigate to="/employee/center" replace />}
          />
          <Route
            path="/employee/profile"
            element={
              <EmployeeShell>
                <EmployeeProfile />
              </EmployeeShell>
            }
          />
          <Route
            path="/employee/history"
            element={
              <EmployeeShell>
                <EmployeeHistory />
              </EmployeeShell>
            }
          />
          <Route
            path="/employee/notifications"
            element={
              <EmployeeShell>
                <EmployeeNotifications />
              </EmployeeShell>
            }
          />
          <Route
            path="/employee/scan/:type"
            element={
              <EmployeeShell>
                <EmployeeScanAutoFlow />
              </EmployeeShell>
            }
          />
          <Route path="/manager/login" element={<ManagerLogin />} />
          <Route
            path="/manager"
            element={
              <ManagerOnly>
                <ManagerDashboard />
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/employees"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner", "manager", "supervisor"]}>
                  <ManagerEmployees />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/workforce"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner"]}>
                  <ManagerWorkforceControls />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/requests"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner", "manager"]}>
                  <ManagerRequests />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/audit"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner", "manager", "supervisor"]}>
                  <ManagerAudit />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/reports"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner", "manager"]}>
                  <GlobalAttendanceReports />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/report-archive"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner", "manager"]}>
                  <ReportArchive />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager/settings"
            element={
              <ManagerOnly>
                <RequireManagerRole roles={["owner"]}>
                  <ManagerSettings />
                </RequireManagerRole>
              </ManagerOnly>
            }
          />
          <Route
            path="/manager-home"
            element={<Navigate to="/manager" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
