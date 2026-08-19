import type { AdminAccount } from "@/types";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const backendEnabled = Boolean(API_URL);

function token() {
  return typeof window === "undefined" ? "" : localStorage.getItem("hadir.api.token") || "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error("Backend غير مفعّل: VITE_API_URL غير مضبوط");
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "فشل الاتصال بالخادم");
  return data as T;
}

export async function backendLogin(username: string, password: string) {
  const data = await request<{ token: string; user: { id: string; username: string; name: string; role: "owner"|"manager"|"supervisor" } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("hadir.api.token", data.token);
  return data.user;
}

export function backendLogout() { localStorage.removeItem("hadir.api.token"); }

export async function getBackendAdmins() {
  return request<Array<{ id:string; username:string; name:string; role:"owner"|"manager"|"supervisor"; active:boolean; createdAt:string }>>("/api/admins");
}

export async function createBackendAdmin(input: { name:string; username:string; password:string; role:"manager"|"supervisor" }) {
  return request<{ok:boolean}>("/api/admins", { method:"POST", body:JSON.stringify(input) });
}

export async function updateBackendAdmin(id:string, input: { name?:string; active?:boolean; password?:string }) {
  return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`, { method:"PATCH", body:JSON.stringify(input) });
}

export async function deleteBackendAdmin(id:string) {
  return request<{ok:boolean}>(`/api/admins/${encodeURIComponent(id)}`, { method:"DELETE" });
}

export async function backendHealth() { return request<{ok:boolean}>("/api/health"); }

export type { AdminAccount };
