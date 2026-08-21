import type { AdminAccount, Employee, AttendanceRecord, EmployeeRequest, Settings, Location } from "@/types";
import { getDeviceLabel } from "@/lib/device";
import { compressProfileImageDataUrl } from "@/lib/imageCompression";

const CANONICAL_API_URL = "https://hadir-api.abunizar963.workers.dev";
const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const API_URL = configuredApiUrl || CANONICAL_API_URL;
export const backendEnabled = true;
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
export const MAX_STORED_AVATAR_BYTES = 100 * 1024;

type RoleHint = "admin" | "employee";
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";
const EMPLOYEE_SESSION_KEY = "hadir.session";
const MANAGER_SESSION_KEY = "hadir.manager_session";

function readStoredJson<T>(key: string): T | null { if (typeof window === "undefined") return null; try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; } }
function hasEmployeeSession(): boolean { const session = readStoredJson<{ employeeId?: string }>(EMPLOYEE_SESSION_KEY); return Boolean(session?.employeeId); }
function hasManagerSession(): boolean { const session = readStoredJson<{ accountId?: string; role?: string }>(MANAGER_SESSION_KEY); return Boolean(session?.accountId || session?.role); }
function tokenForRole(role: RoleHint): string { if (typeof window === "undefined") return ""; return localStorage.getItem(role === "admin" ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY) || ""; }
function activeRole(): RoleHint | undefined { if (hasManagerSession()) return "admin"; if (hasEmployeeSession()) return "employee"; return undefined; }
function token(): string { const role = activeRole(); return role ? tokenForRole(role) : ""; }
function clearRoleSession(role: RoleHint): void { if (typeof window === "undefined") return; localStorage.removeItem(role === "admin" ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY); if (role === "admin") localStorage.removeItem(MANAGER_SESSION_KEY); else localStorage.removeItem(EMPLOYEE_SESSION_KEY); }
function persistToken(role: RoleHint, value: string): void { if (typeof window === "undefined") return; const opposite: RoleHint = role === "admin" ? "employee" : "admin"; clearRoleSession(opposite); localStorage.setItem(role === "admin" ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY, value); }

export function validateAvatarDataUrl(value: unknown): string | null { if (value == null || value === "") return null; if (typeof value !== "string" || !value.startsWith("data:image/")) throw new Error("صورة الموظف غير صالحة."); const comma = value.indexOf(","); if (comma < 0) throw new Error("صيغة صورة الموظف غير صالحة."); const base64 = value.slice(comma + 1); const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0; const bytes = Math.max(0, Math.floor(base64.length * 3 / 4) - padding); if (bytes > MAX_AVATAR_BYTES) throw new Error("حجم صورة الموظف الأصلية يجب ألا يتجاوز 10 ميغابايت."); return value; }
async function prepareAvatar(value: unknown): Promise<string | null> { const validated = validateAvatarDataUrl(value); if (!validated) return null; const compressed = await compressProfileImageDataUrl(validated, { maxWidth: 512, maxHeight: 512, quality: 0.78, type: "image/webp", maxBytes: MAX_STORED_AVATAR_BYTES }); const comma = compressed.indexOf(","); if (comma < 0) throw new Error("تعذر تجهيز صورة الموظف."); const base64 = compressed.slice(comma + 1); const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0; const bytes = Math.max(0, Math.floor(base64.length * 3 / 4) - padding); if (bytes > MAX_STORED_AVATAR_BYTES) throw new Error("تعذر ضغط صورة الموظف إلى أقل من 100 كيلوبايت."); return compressed; }
function dataUrlToBlob(dataUrl: string): Blob { const comma = dataUrl.indexOf(","); if (comma < 0) throw new Error("صيغة الصورة المضغوطة غير صالحة."); const header = dataUrl.slice(0, comma); const base64 = dataUrl.slice(comma + 1); const mime = /^data:([^;]+);base64$/i.exec(header)?.[1] || "image/webp"; const binary = atob(base64); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return new Blob([bytes], { type: mime }); }

async function request<T>(path: string, init: RequestInit = {}, roleHint?: RoleHint): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const role = roleHint || activeRole();
  const authToken = role ? tokenForRole(role) : token();
  if (authToken) headers.set("authorization", `Bearer ${authToken}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal, credentials: "include", cache: "no-store" });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) { const error = data as { error?: unknown }; throw new Error(typeof error.error === "string" ? error.error : `فشل الاتصال بالخادم (${response.status})`); }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("انتهت مهلة الاتصال بخادم حاضر. تحقق من اتصال الإنترنت وCloudflare Worker.");
    if (error instanceof TypeError || (error instanceof Error && (error.message === "Failed to fetch" || error.message === "Load failed" || error.message === "NetworkError when attempting to fetch resource."))) throw new Error(`تعذر الاتصال بخادم حاضر (${API_URL}). تحقق من اتصال الإنترنت وCloudflare Worker.`);
    throw error;
  } finally { window.clearTimeout(timeout); }
}

async function requestWithRetry<T>(path: string, init: RequestInit = {}, attempts = 3, roleHint?: RoleHint): Promise<T> { let lastError: unknown; for (let attempt = 1; attempt <= attempts; attempt += 1) { try { return await request<T>(path, init, roleHint); } catch (error) { lastError = error; if (attempt < attempts) await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt)); } } throw lastError instanceof Error ? lastError : new Error("تعذر الاتصال بخادم حاضر."); }

async function uploadEmployeeAvatar(employeeId: string, dataUrl: string): Promise<{ key: string; size: number }> { const blob = dataUrlToBlob(dataUrl); if (blob.type !== "image/webp" || blob.size <= 0 || blob.size > MAX_STORED_AVATAR_BYTES) throw new Error("صورة الموظف يجب أن تكون WebP وأقل من 100 كيلوبايت."); const form = new FormData(); form.append("file", blob, "avatar.webp"); return requestWithRetry<{ key: string; size: number }>(`/api/employees/${encodeURIComponent(employeeId)}/avatar`, { method: "POST", body: form }, 3, "admin"); }
async function deleteEmployeeAvatar(employeeId: string): Promise<void> { await requestWithRetry<{ ok: boolean }>(`/api/employees/${encodeURIComponent(employeeId)}/avatar`, { method: "DELETE" }, 3, "admin"); }

export async function backendLogin(username: string, password: string) { const data = await requestWithRetry<{ token: string; user: AdminAccount; kind: "admin" | "employee" }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username: username.trim(), password }) }, 3); if (data.kind !== "admin") throw new Error("هذا الحساب موظف وليس حساب إدارة"); persistToken("admin", data.token); return data.user; }
export async function backendEmployeeLogin(username: string, password: string) { if (typeof window === "undefined") throw new Error("تسجيل الدخول متاح من المتصفح فقط."); const key = "hadir.device.id"; const existing = localStorage.getItem(key); const deviceId = existing && existing.trim().length >= 8 ? existing : `dev-${crypto.randomUUID()}`; localStorage.setItem(key, deviceId); const data = await requestWithRetry<{ token: string; user: Employee; kind: "admin" | "employee" }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username: username.trim(), password, deviceId, deviceLabel: getDeviceLabel() }) }, 3); if (data.kind !== "employee") throw new Error("هذا الحساب إداري وليس حساب موظف"); persistToken("employee", data.token); return data.user; }
export async function bootstrapBackend() { const data = await requestWithRetry<{ token: string; bootstrap: boolean }>("/api/bootstrap"); if (!data.bootstrap) throw new Error("تم إعداد حساب المالك مسبقًا"); persistToken("admin", data.token); return data; }
export async function createBootstrapOwner(input: { name: string; username: string; password: string }) { const data = await requestWithRetry<{ token: string; user: AdminAccount; kind: "admin" }>("/api/bootstrap/owner", { method: "POST", body: JSON.stringify(input) }); persistToken("admin", data.token); return data.user; }
export async function backendLogout(role?: RoleHint) { const resolved = role || activeRole(); if (!resolved) return; try { await requestWithRetry<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }, 2, resolved); } finally { clearRoleSession(resolved); } }
export async function backendMe() { const role = activeRole(); return requestWithRetry<{ user: AdminAccount | Employee }>("/api/me", {}, 3, role); }
export async function getBackendAdmins() { return request<Array<{ id: string; username: string; name: string; role: "owner" | "manager" | "supervisor"; active: boolean; createdAt: string }>>("/api/admins", {}, "admin"); }
export async function createBackendAdmin(input: { name: string; username: string; password: string; role: "manager" | "supervisor" }) { return requestWithRetry<{ ok: boolean }>("/api/admins", { method: "POST", body: JSON.stringify(input) }, 3, "admin"); }
export async function updateBackendAdmin(id: string, input: { name?: string; active?: boolean; password?: string }) { return requestWithRetry<{ ok: boolean }>(`/api/admins/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, 3, "admin"); }
export async function deleteBackendAdmin(id: string) { return requestWithRetry<{ ok: boolean }>(`/api/admins/${encodeURIComponent(id)}`, { method: "DELETE" }, 3, "admin"); }
export async function resetBackendEmployeeDevice(id: string) { return requestWithRetry<{ ok: boolean }>(`/api/employees/${encodeURIComponent(id)}/device`, { method: "DELETE" }, 3, "admin"); }
export async function getBackendAttendance(limit = 500) { return request<AttendanceRecord[]>(`/api/attendance?limit=${Math.min(limit, 2000)}`, {}, activeRole()); }
export async function createBackendAttendance(record: Omit<AttendanceRecord, "id" | "ip">) { return requestWithRetry<{ ok: boolean }>("/api/attendance", { method: "POST", body: JSON.stringify(record) }, 3, "employee"); }
export async function getBackendRequests(role?: RoleHint) { return request<EmployeeRequest[]>("/api/requests", {}, role || activeRole()); }
export async function createBackendRequest(input: Omit<EmployeeRequest, "id" | "status" | "createdAt">) { return requestWithRetry<{ ok: boolean }>("/api/requests", { method: "POST", body: JSON.stringify(input) }, 3, "employee"); }
export async function updateBackendRequest(id: string, status: "approved" | "rejected") { return requestWithRetry<{ ok: boolean }>(`/api/requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }, 3, "admin"); }
export async function getBackendAudit(limit = 500) { return request<any[]>(`/api/audit?limit=${Math.min(limit, 2000)}`, {}, "admin"); }
export async function getBackendSettings() { return request<Settings>("/api/settings", {}, "admin"); }
export async function saveBackendSettings(settings: Partial<Settings> & { ownerPassword?: string }) { return requestWithRetry<{ ok: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }, 3, "admin"); }
export async function getBackendLocations(role?: RoleHint) { return request<Location[]>("/api/locations", {}, role || activeRole()); }
export async function saveBackendLocation(location: Location) { return requestWithRetry<{ ok: boolean }>("/api/locations", { method: "PUT", body: JSON.stringify(location) }, 3, "admin"); }
export async function getBackendEmployeeLocation(): Promise<{ location: Location }> { const employee = await getBackendEmployeeProfile(); const locations = await getBackendLocations("employee"); const assigned = employee.locationId ? locations.find((item) => String(item.id) === String(employee.locationId)) : undefined; const main = locations.find((item) => String(item.id) === "main") || locations[0]; const candidate = assigned || main; if (!candidate) throw new Error("لا يوجد موقع عمل محفوظ في قاعدة بيانات D1."); const lat = Number(candidate.lat); const lng = Number(candidate.lng); const radiusMeters = Number(candidate.radiusMeters); if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new Error("بيانات موقع العمل في قاعدة بيانات D1 غير صالحة."); return { location: { id: String(candidate.id), name: String(candidate.name || "المقر الرئيسي"), lat, lng, radiusMeters } }; }
let employeeProfilePromise: Promise<Employee> | null = null; let employeeProfileToken = "";
export async function getBackendEmployeeProfile() { const currentToken = tokenForRole("employee"); if (!currentToken) throw new Error("جلسة الموظف غير موجودة. يرجى تسجيل الدخول مرة أخرى."); if (employeeProfilePromise && employeeProfileToken === currentToken) return employeeProfilePromise; employeeProfileToken = currentToken; const promise = requestWithRetry<Employee>("/api/employee/profile", {}, 3, "employee"); employeeProfilePromise = promise; try { return await promise; } catch (error) { if (employeeProfilePromise === promise) { employeeProfilePromise = null; employeeProfileToken = ""; } throw error; } }
export async function getBackendEmployees() { return request<Employee[]>("/api/employees", {}, "admin"); }
export async function createBackendEmployee(input: Record<string, unknown>) { const avatar = await prepareAvatar(input.avatar); const { avatar: _avatar, ...payload } = input; const created = await requestWithRetry<{ ok: boolean; employee: Employee }>("/api/employees", { method: "POST", body: JSON.stringify(payload) }, 3, "admin"); if (avatar && created.employee?.id) { const uploaded = await uploadEmployeeAvatar(created.employee.id, avatar); created.employee = { ...created.employee, avatar: uploaded.key }; } return created; }
export async function updateBackendEmployee(id: string, input: Record<string, unknown>) { const hasAvatar = Object.prototype.hasOwnProperty.call(input, "avatar"); const avatar = hasAvatar ? await prepareAvatar(input.avatar) : undefined; const { avatar: _avatar, ...payload } = input; const updated = await requestWithRetry<{ ok: boolean; employee: Employee }>(`/api/employees/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }, 3, "admin"); if (hasAvatar) { if (avatar) { const uploaded = await uploadEmployeeAvatar(id, avatar); updated.employee = { ...updated.employee, avatar: uploaded.key }; } else { await deleteEmployeeAvatar(id); updated.employee = { ...updated.employee, avatar: null }; } } return updated; }
export async function deleteBackendEmployee(id: string) { return requestWithRetry<{ ok: boolean }>(`/api/employees/${encodeURIComponent(id)}`, { method: "DELETE" }, 3, "admin"); }
export async function backendHealth() { return request<{ ok: boolean; database?: string; ownerInitialized?: boolean }>("/api/health"); }
export type { AdminAccount };
