import { getEmployees, getManagerSession, getSession, getSettings, setManagerSession, setSession } from "@/lib/storage";
import { verify } from "@/lib/hash";
import { log } from "@/lib/audit";
import { backendLogout } from "@/lib/backend";
import { revokeServerSession } from "@/lib/serverSession";

export interface LoginResult { ok:boolean; success:boolean; reason?:string; }
const normalize=(value:string)=>value.trim();
const ADMIN_TOKEN_KEY="hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY="hadir.api.token.employee";

function savedToken(role:"admin"|"employee"): string {
  if(typeof window === "undefined") return "";
  return sessionStorage.getItem(role === "admin" ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY) || "";
}

/** Local compatibility path. Production credentials are authoritative in D1. */
export function loginEmployee(jobNumber:string,pin:string):LoginResult{
  const username=normalize(jobNumber),employees=getEmployees();
  const emp=employees.find(e=>e.jobNumber.trim()===username||e.id===username);
  if(!emp){log({employeeId:null,jobNumber:username,actorName:"-",action:"login-failed",result:"rejected",reason:"الرقم الوظيفي غير موجود محليًا"});return{ok:false,success:false,reason:"بيانات الموظف تتم إدارتها من قاعدة D1. استخدم تسجيل الدخول المتصل."};}
  if(emp.status!=="active"){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"الحساب موقوف"});return{ok:false,success:false,reason:"الحساب موقوف. يرجى مراجعة الإدارة"};}
  if(!pin||!emp.pinHash||!verify(pin,emp.pinHash)){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"رمز الدخول خاطئ"});return{ok:false,success:false,reason:"الرقم الوظيفي أو رمز الدخول غير صحيح"};}
  setManagerSession(null); setSession({employeeId:emp.id,jobNumber:emp.jobNumber,name:emp.name,loginAt:new Date().toISOString(),role:emp.role});
  log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login",result:"success"}); return{ok:true,success:true};
}
export function logoutEmployee(){const token=savedToken("employee");setSession(null);backendLogout("employee");void revokeServerSession(token);}

/** Legacy local manager authentication no longer has a built-in/default owner account. */
export function loginManager(password:string,username:string):LoginResult{
  const settings=getSettings(),inputUser=normalize(username),inputPassword=password;
  if(!inputUser||!inputPassword)return{ok:false,success:false,reason:"اسم المستخدم وكلمة المرور مطلوبان"};
  const accounts=settings.adminAccounts||[];
  const matched=accounts.find(a=>a.active&&a.username.trim()===inputUser&&Boolean(a.passwordHash)&&verify(inputPassword,a.passwordHash));
  if(!matched){log({employeeId:null,jobNumber:inputUser,actorName:inputUser,action:"manager-login-failed",result:"rejected",reason:"اسم المستخدم أو كلمة المرور خاطئة"});return{ok:false,success:false,reason:"اسم المستخدم وكلمة المرور غير صحيحة"};}
  setSession(null);setManagerSession({loginAt:new Date().toISOString(),name:matched.name,role:matched.role,jobNumber:matched.username,accountId:matched.id});
  const action=matched.role==="owner"?"owner-login":matched.role==="supervisor"?"supervisor-login":"manager-login";
  log({employeeId:null,jobNumber:matched.username,actorName:matched.name,action,result:"success"});return{ok:true,success:true};
}
export function logoutManager(){const token=savedToken("admin");setManagerSession(null);backendLogout("admin");void revokeServerSession(token);}

let cachedSession: ReturnType<typeof getSession> | null | undefined; let cachedSessionKey="";
export function currentSession(){const session=getSession();if(!session){cachedSession=null;cachedSessionKey="";return null;}const key=`${session.employeeId}|${session.jobNumber}|${session.loginAt}|${session.role||""}`;if(cachedSession!==undefined&&cachedSessionKey===key)return cachedSession;cachedSession=session;cachedSessionKey=key;return session;}
export function currentManager(){return getManagerSession();}
export type CurrentUser={role:"owner"|"manager"|"supervisor"|"staff";name?:string;loginAt?:string;jobNumber?:string;};
export function getCurrentUser():CurrentUser|null{const manager=getManagerSession();if(manager){const role=manager.role==="owner"||manager.role==="manager"||manager.role==="supervisor"?manager.role:"manager";return{role,name:manager.name,loginAt:manager.loginAt,jobNumber:manager.jobNumber};}const employee=currentSession();if(employee)return{role:"staff",name:employee.name,loginAt:employee.loginAt,jobNumber:employee.jobNumber};return null;}
