import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import EmployeeLogin from "@/features/auth/employee/EmployeeLogin";
import { EmployeeCenter, EmployeeHistory, EmployeeHome, EmployeePremium, EmployeeProfile, EmployeeScanAutoFlow } from "@/features/employee";
import { ManagerAudit, ManagerDashboard, ManagerEmployees, ManagerLogin, ManagerReports, ManagerRequests, ManagerSettings } from "@/features/manager";
import { AIAssistant, Landing, NotFound, PrayerPage, WeatherPage } from "@/features/shared";
import EmployeeLayout from "@/components/layout/EmployeeLayout";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";
import RequireManagerRole from "@/components/RequireManagerRole";

const ManagerOnly = ({ children }: { children: ReactNode }) => <ProtectedManager>{children}</ProtectedManager>;
const EmployeeShell = ({ children }: { children: ReactNode }) => (
  <ProtectedEmployee><EmployeeLayout>{children}</EmployeeLayout></ProtectedEmployee>
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<EmployeeLogin />} />
      <Route path="/weather" element={<WeatherPage />} />
      <Route path="/prayer" element={<PrayerPage />} />
      <Route path="/ai" element={<AIAssistant />} />

      <Route path="/employee" element={<EmployeeShell><EmployeeHome /></EmployeeShell>} />
      <Route path="/employee/center" element={<EmployeeShell><EmployeeCenter /></EmployeeShell>} />
      <Route path="/employee/premium" element={<EmployeeShell><EmployeePremium /></EmployeeShell>} />
      <Route path="/employee/profile" element={<EmployeeShell><EmployeeProfile /></EmployeeShell>} />
      <Route path="/employee/history" element={<EmployeeShell><EmployeeHistory /></EmployeeShell>} />
      <Route path="/employee/scan/:type" element={<EmployeeShell><EmployeeScanAutoFlow /></EmployeeShell>} />

      <Route path="/manager/login" element={<ManagerLogin />} />
      <Route path="/manager" element={<ManagerOnly><ManagerDashboard /></ManagerOnly>} />
      <Route path="/manager/employees" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager", "supervisor"]}><ManagerEmployees /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/requests" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager"]}><ManagerRequests /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/audit" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager", "supervisor"]}><ManagerAudit /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/reports" element={<ManagerOnly><RequireManagerRole roles={["owner", "manager"]}><ManagerReports /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager/settings" element={<ManagerOnly><RequireManagerRole roles={["owner"]}><ManagerSettings /></RequireManagerRole></ManagerOnly>} />
      <Route path="/manager-home" element={<Navigate to="/manager" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
