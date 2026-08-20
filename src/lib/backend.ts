import type { AdminAccount, Employee, AttendanceRecord, EmployeeRequest, Settings, Location } from "@/types";
import { getDeviceId, getDeviceLabel, getPersistentFingerprintId } from "@/lib/device";

const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
export const backendEnabled = Boolean(API_URL);
function token() { return typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token") || ""; }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("content-type", "application/json"); const t=token(); if(t)headers.set("authorization",`Bearer ${t}`); const device=getDeviceId(); if(device)headers.set("x-device-id",device);
  let response:Response; try{response=await fetch(`${API_URL}${path}`,{...init,headers});}catch{throw new Error("تعذر الاتصال بخادم حاضر. تحقق من اتصال Cloudflare Worker.");}
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error((data as any).error||`فشل الاتصال بالخادم (${response.status})`); return data as T;
}
export async function backendLogin(username:string,password:string){const data=await request<{token:string;user:any;kind:"admin"|"employee"}>("/api/auth/login",{method:"POST",body:JSON.stringify({username,password,deviceId:getDeviceId()})});if(data.kind!=="admin")throw new Error("هذا الحساب موظف وليس حساب إدارة");localStorage.setItem("hadir.api.token",data.token);return data.user;}
export async function backendEmployeeLogin(username:string,password:string){
  const fingerprintId=await getPersistentFingerprintId();
  const data=await request<{token:string;user:any;kind:"admin"|"employee"}>("/api/auth/login",{method:"POST",body:JSON.stringify({username,password,deviceId:fingerprintId,fingerprintId})});
  if(data.kind!=="employee")throw new Error("هذا الحساب إداري وليس حساب موظف");localStorage.setItem("hadir.api.token",data.token);return data.user as Employee;
}
export async function bootstrapBackend(){const data=await request<{token:string;bootstrap:boolean}>("/api/bootstrap");if(!data.bootstrap)throw new Error("تم إعداد حساب المالك مسبقًا");localStorage.setItem("hadir.api.token",data.token);return data;}
export async function createBootstrapOwner(input:{name:string;username:string;password:string}){const data=await request<{token:string;user:any;kind:"admin"}>("/api/bootstrap/owner",{method:"POST",body:JSON.stringify(input)});localStorage.setItem("hadir.api.token",data.token);return data.user;}
export function backendLogout(){localStorage.removeItem("hadir.api.token");} export async function backendMe(){return request<{user:any}>("/api/me");}
export async function getBackendAdmins(){return request<Array<{id:string;username:string;name:string;role:"owner"|"manager"|"supervisor";active:boolean;createdAt:string}>>("/api/admins");}
export async function createBackendAdmin(input:{name:string;username:string;password:string;role:"manager"|"supervisor"}){return request<{ok:boolean}>("/api/admins",{method:"POST",body:JSON.stringify(input)});}
export async function updateBackendAdmin(id:string,input:{name?:string;active?:boolean;password?:string}){return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(input)});}
export async function deleteBackendAdmin(id:string){return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`,{method:"DELETE"});}
export async function getBackendEmployees(){return request<Employee[]>("/api/employees");}
export async function createBackendEmployee(input:any){return request<{ok:boolean;employee:Employee}>("/api/employees",{method:"POST",body:JSON.stringify(input)});}
export async function updateBackendEmployee(id:string,input:any){return request<{ok:boolean;employee:Employee}>(`/api/employees/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(input)});}
export async function deleteBackendEmployee(id:string){return request<{ok:boolean}>(`/api/employees/${encodeURIComponent(id)}`,{method:"DELETE"});}
export async function resetBackendEmployeeDevice(id:string){return request<{ok:boolean}>(`/api/employees/${encodeURIComponent(id)}/device`,{method:"DELETE"});}
export async function getBackendAttendance(limit=500){return request<AttendanceRecord[]>(`/api/attendance?limit=${Math.min(limit,2000)}`);}
export async function createBackendAttendance(record:Omit<AttendanceRecord,"id"|"ip">){return request<{ok:boolean}>("/api/attendance",{method:"POST",body:JSON.stringify(record)});}
export async function getBackendRequests(){return request<EmployeeRequest[]>("/api/requests");}
export async function createBackendRequest(input:Omit<EmployeeRequest,"id"|"status"|"createdAt">){return request<{ok:boolean}>("/api/requests",{method:"POST",body:JSON.stringify(input)});}
export async function updateBackendRequest(id:string,status:"approved"|"rejected"){return request<{ok:boolean}>(`/api/requests/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status})});}
export async function getBackendAudit(limit=500){return request<any[]>(`/api/audit?limit=${Math.min(limit,2000)}`);}
export async function getBackendSettings(){return request<Settings>("/api/settings");}
export async function saveBackendSettings(settings:Partial<Settings>&{ownerPassword?:string}){return request<{ok:boolean}>("/api/settings",{method:"PUT",body:JSON.stringify(settings)});}
export async function getBackendLocations(){return request<Location[]>("/api/locations");}
export async function saveBackendLocation(location:Location){return request<{ok:boolean}>("/api/locations",{method:"PUT",body:JSON.stringify(location)});}
export async function getBackendEmployeeLocation(){return request<{location:Location}>("/api/employee-location");}
export async function backendHealth(){return request<{ok:boolean;database?:string;ownerInitialized?:boolean}>("/api/health");}
export type { AdminAccount };
