import { getEmployees, getManagerSession, getSession, getSettings, saveEmployees, setManagerSession, setSession } from "@/lib/storage";
import { hash, verify } from "@/lib/hash";
import { getDeviceId, getDeviceLabel } from "@/lib/device";
import { log } from "@/lib/audit";

export interface LoginResult { ok:boolean; success:boolean; reason?:string; needsDeviceBinding?:boolean; }
const DEFAULT_OWNER_USERNAME="AbuNizar";
const DEFAULT_OWNER_PASSWORD="963963963";
const normalize=(value:string)=>value.trim();

export function loginEmployee(jobNumber:string,pin:string):LoginResult{
  const username=normalize(jobNumber),employees=getEmployees();
  const emp=employees.find(e=>e.jobNumber.trim()===username||e.id===username);
  if(!emp){log({employeeId:null,jobNumber:username,actorName:"-",action:"login-failed",result:"rejected",reason:"الرقم الوظيفي غير موجود"});return{ok:false,success:false,reason:"الرقم الوظيفي أو رمز الدخول غير صحيح"};}
  if(emp.status!=="active"){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"الحساب موقوف"});return{ok:false,success:false,reason:"الحساب موقوف. يرجى مراجعة الإدارة"};}
  if(!pin||!emp.pinHash||!verify(pin,emp.pinHash)){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"رمز الدخول خاطئ"});return{ok:false,success:false,reason:"الرقم الوظيفي أو رمز الدخول غير صحيح"};}
  const deviceId=getDeviceId(),deviceLabel=getDeviceLabel();
  if(!emp.deviceId){const index=employees.findIndex(e=>e.id===emp.id);if(index>=0){employees[index]={...employees[index],deviceId,deviceLabel};saveEmployees(employees);}log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"device-bound",result:"success",reason:`تم ربط الجهاز: ${deviceLabel}`});}
  else if(emp.deviceId!==deviceId){log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login-failed",result:"rejected",reason:"محاولة تسجيل دخول من جهاز غير موثّق"});return{ok:false,success:false,reason:"هذا الجهاز غير موثّق لحسابك. يرجى مراجعة الإدارة لإلغاء ربط الجهاز السابق."};}
  setSession({employeeId:emp.id,jobNumber:emp.jobNumber,name:emp.name,loginAt:new Date().toISOString(),role:emp.role});
  log({employeeId:emp.id,jobNumber:emp.jobNumber,actorName:emp.name,action:"login",result:"success"});
  return{ok:true,success:true};
}
export function logoutEmployee(){setSession(null);}

export function loginManager(password:string,username:string):LoginResult{
  const settings=getSettings(),inputUser=normalize(username),inputPassword=password;
  if(!inputUser||!inputPassword)return{ok:false,success:false,reason:"اسم المستخدم وكلمة المرور مطلوبان"};
  const accounts=settings.adminAccounts||[];
  const matched=accounts.find(a=>a.active&&a.username.trim()===inputUser&&Boolean(a.passwordHash)&&verify(inputPassword,a.passwordHash));
  const defaultOwnerLogin=inputUser===DEFAULT_OWNER_USERNAME&&inputPassword===DEFAULT_OWNER_PASSWORD;
  if(!matched&&!defaultOwnerLogin){log({employeeId:null,jobNumber:inputUser,actorName:inputUser,action:"manager-login-failed",result:"rejected",reason:"اسم المستخدم أو كلمة المرور خاطئة"});return{ok:false,success:false,reason:"اسم المستخدم أو كلمة المرور غير صحيحة"};}
  const account=matched||{id:"owner-account",username:DEFAULT_OWNER_USERNAME,passwordHash:hash(DEFAULT_OWNER_PASSWORD),name:"المالك",role:"owner" as const,active:true,createdAt:new Date(0).toISOString()};
  const action=account.role==="owner"?"owner-login":account.role==="supervisor"?"supervisor-login":"manager-login";
  setManagerSession({loginAt:new Date().toISOString(),name:account.name,role:account.role,jobNumber:account.username,accountId:account.id});
  log({employeeId:null,jobNumber:account.username,actorName:account.name,action,result:"success"});
  return{ok:true,success:true};
}
export function logoutManager(){setManagerSession(null);}
export function currentSession(){return getSession();}
export function currentManager(){return getManagerSession();}
export type CurrentUser={role:"owner"|"manager"|"supervisor"|"staff";name?:string;loginAt?:string;jobNumber?:string;};
export function getCurrentUser():CurrentUser|null{
  const manager=getManagerSession();
  if(manager){const role=manager.role==="owner"||manager.role==="manager"||manager.role==="supervisor"?manager.role:"manager";return{role,name:manager.name,loginAt:manager.loginAt,jobNumber:manager.jobNumber};}
  const employee=getSession();
  if(employee)return{role:"staff",name:employee.name,loginAt:employee.loginAt,jobNumber:employee.jobNumber};
  return null;
}
