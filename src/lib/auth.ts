import { getEmployees, getManagerSession, getSession, getSettings, setManagerSession, setSession } from "@/lib/storage";
import { hash, verify } from "@/lib/hash";
import { log } from "@/lib/audit";
import { backendLogout } from "@/lib/backend";

export interface LoginResult { ok:boolean; success:boolean; reason?:string; }
const DEFAULT_OWNER_USERNAME="AbuNizar";
const DEFAULT_OWNER_PASSWORD="963963963";
const normalize=(value:string)=>value.trim();

/**
 * Legacy local authentication is retained only for compatibility with the
 * offline/admin UI. Employee production authentication must use backendEmployeeLogin,
 * which validates the employee against Cloudflare D1.
 */
export function loginEmployee(jobNumber:string,pin:string):LoginResult{
  const username=normalize(jobNumber),employees=getEmployees();
  const emp=employees.find(e=>e.jobNumber.trim()===username||e.id===username);
  if(!emp){log({employeeId:null,jobNumber:username,actorName:"-",action:"login-failed",result:"rejected",reason:"الرقم الوظيفي غير موجود محليًا"});return{ok:false,success:false,reason:"بيانات الموظف تتم إدارتها من قاعدة D1. استخدم تسجيل الدخول المتصل."};}
  if(emp.status!=="active"){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"الحساب موقوف"});return{ok:false,success:false,reason:"الحساب موقوف. يرجى مراجعة الإدارة"};}
  if(!pin||!emp.pinHash||!verify(pin,emp.pinHash)){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"رمز الدخول خاطئ"});return{ok:false,success:false,reason:"الرقم الوظيفي أو رمز الدخول غير صحيح"};}
  setManagerSession(null);
  setSession({employeeId:emp.id,jobNumber:emp.jobNumber,name:emp.name,loginAt:new Date().toISOString(),role:emp.role});
  log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login",result:"success"});
  return{ok:true,success:true};
}
export function logoutEmployee(){setSession(null);backendLogout("employee");}

export function loginManager(password:string,username:string):LoginResult{
  const settings=getSettings(),inputUser=normalize(username),inputPassword=password;
  if(!inputUser||!inputPassword)return{ok:false,success:false,reason:"اسم المستخدم وكلمة المرور مطلوبان"};
  const accounts=settings.adminAccounts||[];
  const matched=accounts.find(a=>a.active&&a.username.trim()===inputUser&&Boolean(a.passwordHash)&&verify(inputPassword,a.passwordHash));
  const defaultOwnerLogin=accounts.length===0&&inputUser===DEFAULT_OWNER_USERNAME&&inputPassword===DEFAULT_OWNER_PASSWORD;
  if(!matched&&!defaultOwnerLogin){log({employeeId:null,jobNumber:inputUser,actorName:inputUser,action:"manager-login-failed",result:"rejected",reason:"اسم المستخدم أو كلمة المرور خاطئة"});return{ok:false,success:false,reason:"اسم المستخدم وكلمة المرور غير صحيحة"};}
  const account=matched||{id:"owner-account",username:DEFAULT_OWNER_USERNAME,passwordHash:hash(DEFAULT_OWNER_PASSWORD),name:"المالك",role:"owner" as const,active:true,createdAt:new Date(0).toISOString()};
  const action=account.role==="owner"?"owner-login":account.role==="supervisor"?"supervisor-login":"manager-login";
  setSession(null);
  setManagerSession({loginAt:new Date().toISOString(),name:account.name,role:account.role,jobNumber:account.username,accountId:account.id});
  log({employeeId:null,jobNumber:account.username,actorName:account.name,action,result:"success"});
  return{ok:true,success:true};
}
export function logoutManager(){setManagerSession(null);backendLogout("admin");}

/** Local UI session only. The employee record and credentials remain authoritative in D1. */
let cachedSession: ReturnType<typeof getSession> | null | undefined;
let cachedSessionKey = "";
export function currentSession(){
  const session=getSession();
  if(!session) { cachedSession=null; cachedSessionKey=""; return null; }
  const key=`${session.employeeId}|${session.jobNumber}|${session.loginAt}|${session.role||""}`;
  if(cachedSession !== undefined && cachedSessionKey===key) return cachedSession;
  cachedSession=session;
  cachedSessionKey=key;
  return session;
}

export function currentManager(){return getManagerSession();}
export type CurrentUser={role:"owner"|"manager"|"supervisor"|"staff";name?:string;loginAt?:string;jobNumber?:string;};
export function getCurrentUser():CurrentUser|null{
  const manager=getManagerSession();
  if(manager){const role=manager.role==="owner"||manager.role==="manager"||manager.role==="supervisor"?manager.role:"manager";return{role,name:manager.name,loginAt:manager.loginAt,jobNumber:manager.jobNumber};}
  const employee=currentSession();
  if(employee)return{role:"staff",name:employee.name,loginAt:employee.loginAt,jobNumber:employee.jobNumber};
  return null;
}