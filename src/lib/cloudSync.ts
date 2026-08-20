import type { Employee } from "@/types";
import { backendEnabled, getBackendEmployees, createBackendEmployee, updateBackendEmployee, deleteBackendEmployee } from "@/lib/backend";
import { setD1View } from "@/lib/d1View";

let running = false;
let pending: { employees: Employee[]; pins?: Record<string, string> } | null = null;

function scheduleFields(employee: Employee) {
  const rotation = employee.scheduleType === "ROTATION";
  return { scheduleType: rotation ? "ROTATION" : "ADMIN", rotationStartDate: rotation ? (employee.rotationStartDate || null) : null, workStartTime: rotation ? "00:00" : (employee.workStartTime || "08:00"), workEndTime: rotation ? "00:00" : (employee.workEndTime || "16:00"), rotationDaysOn: rotation ? Math.max(1, Math.floor(employee.rotationDaysOn ?? 4)) : null, rotationDaysOff: rotation ? Math.max(0, Math.floor(employee.rotationDaysOff ?? 4)) : null, workDays: rotation ? undefined : employee.workDays };
}

async function pushEmployees(list: Employee[], pins?: Record<string, string>) {
  const remote = await getBackendEmployees();
  const byId = new Map(remote.map(e => [e.id, e]));
  const byJob = new Map(remote.map(e => [e.jobNumber, e]));
  for (const employee of list) {
    const existing = byId.get(employee.id) || byJob.get(employee.jobNumber);
    if (!existing) {
      const pin = pins?.[employee.id];
      if (!pin) continue;
      await createBackendEmployee({ ...employee, deviceId: null, deviceLabel: null, ...scheduleFields(employee), pin });
      continue;
    }
    const input: any = { jobNumber: employee.jobNumber, name: employee.name, status: employee.status, ...scheduleFields(employee), gracePeriodMinutes: employee.gracePeriodMinutes, role: employee.role, locationId: employee.locationId, specialties: employee.specialties, avatar: employee.avatar };
    const pin = pins?.[employee.id]; if (pin) input.pin = pin;
    // Never send deviceId/deviceLabel from the browser. Device security is D1/Worker-owned.
    await updateBackendEmployee(existing.id, input);
  }
  const refreshed = await getBackendEmployees();
  setD1View({ employees: refreshed });
}

export async function syncEmployeesToCloud(employees: Employee[] = [], pins?: Record<string, string>) {
  if (!backendEnabled) return;
  pending = { employees, pins };
  if (running) return;
  running = true;
  try {
    while (pending) { const current = pending; pending = null; try { await pushEmployees(current.employees, current.pins); } catch (error) { console.warn("Hadir D1 employee write deferred:", error); } }
  } finally { running = false; }
}

export async function pullEmployeesFromCloud() {
  if (!backendEnabled) return;
  try { setD1View({ employees: await getBackendEmployees() }); } catch (error) { console.warn("Hadir D1 employee read deferred:", error); }
}

export async function removeEmployeeFromCloud(id: string) {
  if (!backendEnabled) return;
  try { await deleteBackendEmployee(id); setD1View({ employees: await getBackendEmployees() }); } catch (error) { console.warn("Hadir D1 delete deferred:", error); }
}
