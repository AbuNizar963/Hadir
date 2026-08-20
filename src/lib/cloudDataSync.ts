import { backendEnabled, getBackendAttendance, getBackendRequests, getBackendAudit, getBackendEmployees } from "@/lib/backend";

const EMPLOYEES_KEY = "hadir.employees";
let syncTimer: number | null = null;
let syncing = false;

function syncEmployees(employees: any[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(EMPLOYEES_KEY);
    const local = raw ? JSON.parse(raw) : [];
    const byId = new Map(local.map((e: any) => [e.id, e]));
    const byJob = new Map(local.map((e: any) => [String(e.jobNumber), e]));
    const merged = employees.map((remote: any) => {
      const cached = byId.get(remote.id) || byJob.get(String(remote.jobNumber));
      // D1 is authoritative for all employee fields. Only retain the local
      // password hash because the API intentionally never returns it.
      return cached?.pinHash ? { ...remote, pinHash: cached.pinHash } : remote;
    });
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("hadir:employees-changed"));
    window.dispatchEvent(new Event("hadir:cloud-data-changed"));
  } catch (error) {
    console.warn("Hadir employee cloud hydration failed:", error);
  }
}

export async function hydrateLocalData() {
  if (!backendEnabled || typeof window === "undefined" || syncing) return;
  syncing = true;
  try {
    const [employees, attendance, requests, audit] = await Promise.all([
      getBackendEmployees(),
      getBackendAttendance(2000),
      getBackendRequests(),
      getBackendAudit(2000),
    ]);

    // IMPORTANT: employees come from D1 and overwrite stale local schedules.
    syncEmployees(employees);
    localStorage.setItem("hadir.attendance", JSON.stringify(attendance));
    localStorage.setItem("hadir.requests", JSON.stringify(requests));
    localStorage.setItem("hadir.audit", JSON.stringify(audit));
    window.dispatchEvent(new Event("hadir:cloud-data-changed"));
  } catch (error) {
    console.warn("Hadir cloud data hydration deferred:", error);
  } finally {
    syncing = false;
  }
}

export function startCloudDataSync(intervalMs = 5000) {
  if (!backendEnabled || typeof window === "undefined" || syncTimer !== null) return;
  void hydrateLocalData();
  syncTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void hydrateLocalData();
  }, intervalMs);

  const refresh = () => void hydrateLocalData();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
}

// Start as soon as this module is loaded. This keeps the employee view
// synchronized even when the user refreshes/navigates directly to it.
startCloudDataSync();
