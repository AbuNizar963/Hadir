import type { AIInsight, AnomalyEvent, LeaveRequest, LiveNotification, PerformanceReview, TaskPriority, TaskStatus, Violation, WorkforceTask } from "@/types/workforce";

const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
function token() { return localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || ""; }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("content-type", "application/json");
  const t = token(); if (t) headers.set("authorization", `Bearer ${t}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as any).error || "تعذر تنفيذ العملية"));
  return data as T;
}
export const workforce = {
  notifications: () => request<LiveNotification[]>("/api/workforce/notifications"),
  markNotificationRead: (id: string) => request<{ ok: true }>(`/api/workforce/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
  violations: (employeeId?: string) => request<Violation[]>(`/api/workforce/violations${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""}`),
  leaveRequests: () => request<LeaveRequest[]>("/api/workforce/leave-requests"),
  createLeaveRequest: (body: Pick<LeaveRequest, "type" | "startDate" | "endDate" | "reason">) => request<LeaveRequest>("/api/workforce/leave-requests", { method: "POST", body: JSON.stringify(body) }),
  reviewLeave: (id: string, status: "approved" | "rejected") => request<LeaveRequest>(`/api/workforce/leave-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  tasks: () => request<WorkforceTask[]>("/api/workforce/tasks"),
  createTask: (body: { title: string; description?: string; assigneeId?: string; priority?: TaskPriority; dueAt?: string }) => request<WorkforceTask>("/api/workforce/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: { status?: TaskStatus; priority?: TaskPriority }) => request<WorkforceTask>(`/api/workforce/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  performance: (employeeId: string) => request<PerformanceReview[]>(`/api/workforce/performance/${encodeURIComponent(employeeId)}`),
  anomalies: () => request<AnomalyEvent[]>("/api/workforce/anomalies"),
  insights: (scope = "dashboard") => request<AIInsight[]>(`/api/workforce/insights?scope=${encodeURIComponent(scope)}`),
};

export function subscribeWorkforceUpdates(handler: (event: Event) => void) {
  window.addEventListener("hadir:cloud-data-changed", handler);
  window.addEventListener("hadir:d1-view-changed", handler);
  return () => { window.removeEventListener("hadir:cloud-data-changed", handler); window.removeEventListener("hadir:d1-view-changed", handler); };
}
