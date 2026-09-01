import { getBackendAttendance, getBackendEmployees, getBackendRequests, getBackendAudit, backendEnabled } from "@/lib/backend";
import { setD1View, getD1View } from "@/lib/d1View";
import type { Employee, AttendanceRecord, EmployeeRequest, AuditEntry } from "@/types";

let lastSyncTime = 0;
const SYNC_INTERVAL = 30000; // 30 seconds
let syncInProgress = false;

export async function syncReportData() {
  if (!backendEnabled) return;
  if (syncInProgress) return;
  
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL) return;
  
  syncInProgress = true;
  try {
    const [employees, attendance, requests, audit] = await Promise.all([
      getBackendEmployees().catch(() => [] as Employee[]),
      getBackendAttendance(2000).catch(() => [] as AttendanceRecord[]),
      getBackendRequests().catch(() => [] as EmployeeRequest[]),
      getBackendAudit(2000).catch(() => [] as AuditEntry[]),
    ]);
    
    setD1View({
      employees: Array.isArray(employees) ? employees : [],
      attendance: Array.isArray(attendance) ? attendance : [],
      requests: Array.isArray(requests) ? requests : [],
      audit: Array.isArray(audit) ? audit : [],
      loadedAt: new Date().toISOString(),
    });
    
    lastSyncTime = now;
  } catch (error) {
    console.warn("Report sync error:", error);
  } finally {
    syncInProgress = false;
  }
}

export function getLastSyncTime(): Date | null {
  return lastSyncTime ? new Date(lastSyncTime) : null;
}
