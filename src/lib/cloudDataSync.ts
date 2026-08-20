import { backendEnabled, getBackendAttendance, getBackendRequests, getBackendAudit, getBackendEmployees, getBackendSettings, getBackendLocations, getBackendAdmins } from "@/lib/backend";
import { setD1View } from "@/lib/d1View";

let syncTimer: number | null = null;
let syncing = false;

export async function hydrateLocalData() {
  if (!backendEnabled || typeof window === "undefined" || syncing) return;
  syncing = true;
  try {
    const [employees, attendance, requests, audit, settings, locations, admins] = await Promise.all([
      getBackendEmployees(), getBackendAttendance(2000), getBackendRequests(), getBackendAudit(2000),
      getBackendSettings(), getBackendLocations(), getBackendAdmins(),
    ]);
    setD1View({ employees, attendance, requests, audit, settings, locations, admins: admins as any });
  } catch (error) {
    console.warn("Hadir D1 refresh deferred:", error);
  } finally { syncing = false; }
}

export function startCloudDataSync(intervalMs = 15000) {
  if (!backendEnabled || typeof window === "undefined" || syncTimer !== null) return;
  void hydrateLocalData();
  syncTimer = window.setInterval(() => { if (document.visibilityState === "visible") void hydrateLocalData(); }, intervalMs);
  const refresh = () => void hydrateLocalData();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
}

startCloudDataSync();
