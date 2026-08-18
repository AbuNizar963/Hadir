import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLogin from "@/pages/EmployeeLogin";
import EmployeeHome from "@/pages/EmployeeHome";
import EmployeeScan from "@/pages/EmployeeScan";
import ManagerLogin from "@/pages/ManagerLogin";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ManagerEmployees from "@/pages/ManagerEmployees";
import ManagerAudit from "@/pages/ManagerAudit";
import ManagerSettings from "@/pages/ManagerSettings";
import ManagerReports from "@/pages/ManagerReports";
import NotFound from "@/pages/NotFound";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<EmployeeLogin />} />
        <Route
          path="/employee"
          element={
            <ProtectedEmployee>
              <EmployeeHome />
            </ProtectedEmployee>
          }
        />
        <Route
          path="/employee/scan/:type"
          element={
            <ProtectedEmployee>
              <EmployeeScan />
            </ProtectedEmployee>
          }
        />

        <Route path="/manager/login" element={<ManagerLogin />} />
        <Route
          path="/manager"
          element={
            <ProtectedManager>
              <ManagerDashboard />
            </ProtectedManager>
          }
        />
        <Route
          path="/manager/employees"
          element={
            <ProtectedManager>
              <ManagerEmployees />
            </ProtectedManager>
          }
        />
        <Route
          path="/manager/audit"
          element={
            <ProtectedManager>
              <ManagerAudit />
            </ProtectedManager>
          }
        />
        <Route
          path="/manager/reports"
          element={
            <ProtectedManager>
              <ManagerReports />
            </ProtectedManager>
          }
        />
        <Route
          path="/manager/settings"
          element={
            <ProtectedManager>
              <ManagerSettings />
            </ProtectedManager>
          }
        />
        <Route path="/manager-home" element={<Navigate to="/manager" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
