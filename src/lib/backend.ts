import type { AdminAccount, Employee, AttendanceRecord, EmployeeRequest, Settings, Location } from "@/types";
import { getPersistentFingerprintId, getDeviceLabel } from "@/lib/device";
import { compressProfileImageDataUrl } from "@/lib/imageCompression";

const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
export const backendEnabled = Boolean(API_URL);
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
export function validateAvatarDataUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.startsWith("data:image/")) throw new Error("صورة الموظف غير صالحة.");
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("صيغة صورة الموظف غير صالحة.");
  const base64 = value.slice(comma + 1);
  const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_AVATAR_BYTES) throw new Error("حجم صورة الموظف يجب ألا يتجاوز 10 ميغابايت.");
  return value;
}

async function prepareAvatar(value: unknown): Promise<string | null> {
  const validated = validateAvatarDataUrl(value);
  if (!validated) return null;
  return compressProfileImageDataUrl(validated, {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.78,
    type: "image/webp",
  });
}

function token() { return typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || ""; }
function persistToken(value: string) { localStorage.setItem("hadir.api.token", value); localStorage.setItem("hadir.auth.token", value); }

if (typeof window !== "undefined" && !(window as any).__hadirApiFetchInstalled) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (rawUrl.startsWith("/api/")) {
      const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
      const t = token();
      if (t && !headers.has("authorization")) headers.set("authorization", `Bearer ${t}`);
      return nativeFetch(`${API_URL}${rawUrl}`, { ...init, headers });
    }
    return nativeFetch(input, init);
  };
  (window as any).__hadirApiFetchInstalled = true;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("content-type", "application/json"); const t = token(); if (t) headers.set("authorization", `Bearer ${t}`);
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000); let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal }); }
  catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw new Error("انتهت مهلة الاتصال بخادم حاضر. تحقق من اتصال الإنترنت وCloudflare Worker."); throw new Error("تعذر الاتصال بخادم حاضر. تحقق من اتصال الإنترنت وCloudflare Worker."); }
  finally { window.clearTimeout(timeout); }
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error((data as any).error || `فشل الاتصال بالخادم (${response.status})`); return data as T;
}
export async function backendLogin(username: string, password: string) { const data = await request<{ token:string;user:any;kind:"admin"|"employee" }>("/api/auth/login",{method:"POST",body:JSON.stringify({username,password})}); if(data.kind!=="admin")throw new Error("هذا الحساب موظف وليس حساب إدارة"); persistToken(data.token); return data.user; }
export async function backendEmployeeLogin(username: string, password: string) { let deviceId: string; try { deviceId = await getPersistentFingerprintId(); } catch { throw new Error("تعذر التحقق من الجهاز. فعّل JavaScript وحاول مرة أخرى."); } const data = await request<{ token:string;user:any;kind:"admin"|"employee" }>("/api/auth/login",{method:"POST",body:JSON.stringify({username:username.trim(),password,deviceId,deviceLabel:getDeviceLabel()})}); if(data.kind!=="employee")throw new Error("هذا الحساب إداري وليس حساب موظف"); persistToken(data.token); return data.user as Employee; }
export async function bootstrapBackend(){const data=await request<{token:string;bootstrap:boolean}>("/api/bootstrap");if(!data.bootstrap)throw new Error("تم إعداد حساب المالك مسبقًا");persistToken(data.token);return data;}
export async function createBootstrapOwner(input:{name:string;username:string;password:string}){const data=await request<{token:string;user:any;kind:"admin"}>("/api/bootstrap/owner",{method:"POST",body:JSON.stringify(input)});persistToken(data.token);return data.user;}
export function backendLogout(){localStorage.removeItem("hadir.api.token");localStorage.removeItem("hadir.auth.token");} export async function backendMe(){return request<{user:any}>("/api/me");}
export async function getBackendAdmins(){return request<Array<{id:string;username:string;name:string;role:"owner"|"manager"|"supervisor";active:boolean;createdAt:string}>>("/api/admins");}
export async function createBackendAdmin(input:{name:string;username:string;password:string;role:"manager"|"supervisor"}){return request<{ok:boolean}>("/api/admins",{method:"POST",body:JSON.stringify(input)});}
export async function updateBackendAdmin(id:string,input:{name?:string;active?:boolean;password?:string}){return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(input)});}
export async function deleteBackendAdmin(id:string){return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`,{method:"DELETE"});}
let employeeProfilePromise: Promise<Employee> | null = null;
let employeeProfileToken = "";
export async function getBackendEmployeeProfile(){
  const currentToken = token();
  if (!currentToken) throw new Error("جلسة الموظف غير موجودة. يرجى تسجيل الدخول مرة أخرى.");
  if (employeeProfilePromise && employeeProfileToken === currentToken) return employeeProfilePromise;
  employeeProfileToken = currentToken;
  employeeProfilePromise = request<Employee>("/api/employee/profile").catch((error) => {
    employeeProfilePromise = null;
    employeeProfileToken = "";
    throw error;
  });
  return employeeProfilePromise;
}
export async function getBackendEmployees(){return request<Employee[]>("/api/employees");}
export async function createBackendEmployee(input:any){
  const avatar = await prepareAvatar(input.avatar);
  return request<{ok:boolean;employee:Employee}>("/api/employees",{method:"POST",body:JSON.stringify({...input,avatar})});
}
export async function updateBackendEmployee(id:string,input:any){
  const avatar = input.avatar === undefined ? undefined : await prepareAvatar(input.avatar);
  return request<{ok:boolean;employee:Employee}>(`/api/employees/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({...input,...(avatar !== undefined ? {avatar} : {})})});
}
export async function deleteBackendEmployee(id:string){return request<{ok:boolean}>(`/api/employees/${encodeURIComponent(id)}`,{method:"DELETE"});}
export async function resetBackendEmployeeDevice(id:string){return request<{ok:boolean}>(`/api/employees/${encodeURIComponent(id)}/device`,{method:"DELETE"});}
export async function getBackendAttendance(limit=500){return request<AttendanceRecord[]>(`/api/attendance?limit=${Math.min(limit,2000)}`);} export async function createBackendAttendance(record:Omit<AttendanceRecord,"id"|"ip">){return request<{ok:boolean}>("/api/attendance",{method:"POST",body:JSON.stringify(record)});}
export async function getBackendRequests(){return request<EmployeeRequest[]>("/api/requests");} export async function createBackendRequest(input:Omit<EmployeeRequest,"id"|"status"|"createdAt">){return request<{ok:boolean}>("/api/requests",{method:"POST",body:JSON.stringify(input)});}
export async function updateBackendRequest(id:string,status:"approved"|"rejected"){return request<{ok:boolean}>(`/api/requests/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status})});}
export async function getBackendAudit(limit=500){return request<any[]>(`/api/audit?limit=${Math.min(limit,2000)}`);} export async function getBackendSettings(){return request<Settings>("/api/settings");}
export async function saveBackendSettings(settings:Partial<Settings>&{ownerPassword?:string}){return request<{ok:boolean}>("/api/settings",{method:"PUT",body:JSON.stringify(settings)});}
export async function getBackendLocations(){return request<Location[]>("/api/locations");} export async function saveBackendLocation(location:Location){return request<{ok:boolean}>("/api/locations",{method:"PUT",body:JSON.stringify(location)});}
export async function getBackendEmployeeLocation(){return request<{location:Location}>("/api/employee-location");} export async function backendHealth(){return request<{ok:boolean;database?:string;ownerInitialized?:boolean}>("/api/health");} export type {AdminAccount};
