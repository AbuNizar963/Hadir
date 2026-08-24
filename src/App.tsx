import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLogin from "@/features/auth/employee/EmployeeLogin";
import EmployeeHome from "@/pages/EmployeeHome";
import EmployeeHistory from "@/pages/EmployeeHistory";
import EmployeeScan from "@/pages/EmployeeScan";
import EmployeeProfile from "@/pages/EmployeeProfile";
import EmployeeCenter from "@/pages/EmployeeCenter";
import EmployeePremium from "@/pages/EmployeePremium";
import WeatherPage from "@/pages/WeatherPage";
import PrayerPage from "@/pages/PrayerPage";
import AIAssistant from "@/pages/AIAssistant";
import ManagerLogin from "@/pages/ManagerLogin";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ManagerEmployees from "@/pages/ManagerEmployees";
import ManagerRequests from "@/pages/ManagerRequests";
import ManagerAudit from "@/pages/ManagerAudit";
import ManagerSettings from "@/pages/ManagerSettings";
import ManagerReports from "@/pages/ManagerReports";
import ContextWidgets from "@/components/ContextWidgets";
import EmployeeAIButton from "@/components/EmployeeAIButton";
import EmployeeLayout from "@/components/layout/EmployeeLayout";
import NotFound from "@/pages/NotFound";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";
import RequireManagerRole from "@/components/RequireManagerRole";

const ManagerOnly = ({ children }: { children: React.ReactNode }) => <ProtectedManager>{children}</ProtectedManager>;
const EmployeeShell = ({ children }: { children: React.ReactNode }) => <ProtectedEmployee><EmployeeLayout>{children}</EmployeeLayout></ProtectedEmployee>;
const EmployeeHomeWithAI = () => <ProtectedEmployee><EmployeeLayout><EmployeeHome /><EmployeeAIButton /></EmployeeLayout></ProtectedEmployee>;
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return <BrowserRouter basename={basename}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<EmployeeLogin />} />
      <Route path="/weather" element={<WeatherPage />} />
      <Route path="/prayer" element={<PrayerPage />} />
      <Route path="/ai" element={<AIAssistant />} />

      <Route path="/employee" element={<EmployeeHomeWithAI />} />
      <Route path="/employee/center" element={<EmployeeShell><EmployeeCenter /></EmployeeShell>} />
      <Route path="/employee/premium" element={<EmployeeShell><EmployeePremium /></EmployeeShell>} />
      <Route path="/employee/profile" element={<EmployeeShell><EmployeeProfile /></EmployeeShell>} />
      <Route path="/employee/history" element={<EmployeeShell><EmployeeHistory /></EmployeeShell>} />
      <Route path="/employee/scan/:type" element={<EmployeeShell><EmployeeScan /></EmployeeShell>} />

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
    <ContextWidgets />
  </BrowserRouter>;
}
