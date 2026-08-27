import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Landing from "@/pages/Landing";
import EmployeeLogin from "@/features/auth/employee/EmployeeLogin";
import EmployeeHome from "@/pages/EmployeeHome";
import EmployeeHistory from "@/pages/EmployeeHistory";
import EmployeeScanAutoFlow from "@/pages/EmployeeScanAutoFlow";
import EmployeeProfile from "@/pages/EmployeeProfile";
import EmployeeCenter from "@/pages/EmployeeCenter";
import EmployeePremium from "@/pages/EmployeePremium";
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
import { getManagerSession } from "@/lib/storage";
import { enableWebPush } from "@/lib/push";
const ManagerOnly = ({ children }: { children: React.ReactNode }) => <ProtectedManager>{children}</ProtectedManager>;
const EmployeeShell = ({ children }: { children: React.ReactNode }) => <ProtectedEmployee><EmployeeLayout>{children}</EmployeeLayout></ProtectedEmployee>;
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
function PushSessionBridge() { const location=useLocation(); const manager=getManagerSession(); useEffect(()=>{if(!location.pathname.startsWith("/manager")||location.pathname==="/manager/login"||!manager?.accountId)return;const key=`hadir.push.manager.${manager.accountId}`;if(sessionStorage.getItem(key)==="enabled")return;void enableWebPush(String(manager.accountId)).then(result=>{if(result==="enabled")sessionStorage.setItem(key,"enabled");});},[location.pathname,manager?.accountId]);return null; }
export default function App(){return <BrowserRouter basename={basename}><PushSessionBridge/><Routes>
<Route path="/" element={<Landing/>}/><Route path="/login" element={<EmployeeLogin/>}/><Route path="/weather" element={<WeatherPage/>}/><Route path="/prayer" element={<PrayerPage/>}/><Route path="/ai" element={<AIAssistant/>}/>
<Route path="/employee" element={<EmployeeShell><EmployeeHome/></EmployeeShell>}/><Route path="/employee/center" element={<EmployeeShell><EmployeeCenter/></EmployeeShell>}/><Route path="/employee/premium" element={<EmployeeShell><EmployeePremium/></EmployeeShell>}/><Route path="/employee/profile" element={<EmployeeShell><EmployeeProfile/></EmployeeShell>}/><Route path="/employee/history" element={<EmployeeShell><EmployeeHistory/></EmployeeShell>}/><Route path="/employee/notifications" element={<EmployeeShell><EmployeeNotifications/></EmployeeShell>}/><Route path="/employee/scan/:type" element={<EmployeeShell><EmployeeScanAutoFlow/></EmployeeShell>}/>
<Route path="/manager/login" element={<ManagerLogin/>}/><Route path="/manager" element={<ManagerOnly><ManagerDashboard/></ManagerOnly>}/><Route path="/manager/employees" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerEmployees/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/workforce" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerWorkforceControls/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/requests" element={<ManagerOnly><RequireManagerRole roles={["owner","manager"]}><ManagerRequests/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/audit" element={<ManagerOnly><RequireManagerRole roles={["owner","manager","supervisor"]}><ManagerAudit/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/reports" element={<ManagerOnly><RequireManagerRole roles={["owner","manager"]}><ManagerReports/></RequireManagerRole></ManagerOnly>}/><Route path="/manager/settings" element={<ManagerOnly><RequireManagerRole roles={["owner"]}><ManagerSettings/></RequireManagerRole></ManagerOnly>}/><Route path="/manager-home" element={<Navigate to="/manager" replace/>}/><Route path="*" element={<NotFound/>}/>
</Routes></BrowserRouter>;}
