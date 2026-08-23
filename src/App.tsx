import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLogin from "@/features/auth/employee/EmployeeLogin";
import EmployeeHome from "@/pages/EmployeeHome";
import EmployeeHistory from "@/pages/EmployeeHistory";
import EmployeeScan from "@/pages/EmployeeScan";
import EmployeeProfile from "@/pages/EmployeeProfile";
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
import ManagerWorkforce from "@/pages/ManagerWorkforce";
import ContextWidgets from "@/components/ContextWidgets";
import EmployeeAIButton from "@/components/EmployeeAIButton";
import NotFound from "@/pages/NotFound";
import ProtectedEmployee from "@/components/ProtectedEmployee";
import ProtectedManager from "@/components/ProtectedManager";
import RequireManagerRole from "@/components/RequireManagerRole";
const ManagerOnly=({children}:{children:React.ReactNode})=><ProtectedManager>{children}</ProtectedManager>;
const EmployeeHomeWithAI=()=> <><EmployeeHome/><EmployeeAIButton/></>;
const basename=import.meta.env.BASE_URL.replace(/\/$/,"")||undefined;
export default function App(){return <BrowserRouter basename={basename}><Routes>
<Route path="/" element={<Landing/>}/><Route path="/login" element={<EmployeeLogin/>}/><Route path="/weather" element={<WeatherPage/>}/><Route path="/prayer" element={<PrayerPage/>}/>
<Route path="/ai" element={<AIAssistant/>}/><Route path="/employee" element={<ProtectedEmployee><EmployeeHomeWithAI/></ProtectedEmployee>}/><Route path="/employee/profile" element={<ProtectedEmployee><EmployeeProfile/></ProtectedEmployee>}/><Route path="/employee/history" element={<ProtectedEmployee><EmployeeHistory/></ProtectedEmployee>}/><Route path="/employee/scan/:type" element={<ProtectedEmployee><EmployeeScan/></ProtectedEmployee>}/>
<Route path="/manager/login" element={<ManagerLogin/>}/><Route path="/manager" element={<ManagerOnly><ManagerDashboard/></ManagerOnly>}/><Route path="/manager/workforce" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerWorkforce/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/employees" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerEmployees/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/requests" element={<ManagerOnly><RequireManagerRole roles={["owner","manager"]}><ManagerRequests/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/audit" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerAudit/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/reports" element={<ManagerOnly><RequireManagerRole roles={["owner","manager"]}><ManagerReports/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/settings" element={<ManagerOnly><RequireManagerRole roles={["owner"]}><ManagerSettings/></RequireManagerRole></ManagerOnly>}/><Route path="/manager-home" element={<Navigate to="/manager" replace/>}/><Route path="*" element={<NotFound/>}/>
</Routes><ContextWidgets/></BrowserRouter>}
