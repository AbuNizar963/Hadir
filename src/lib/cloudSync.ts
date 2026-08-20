import type { Employee } from "@/types";
import { backendEnabled, getBackendEmployees, createBackendEmployee, updateBackendEmployee, deleteBackendEmployee, resetBackendEmployeeDevice } from "@/lib/backend";

const KEY = "hadir.employees";
let running = false;
let pending: { employees: Employee[]; pins?: Record<string, string> } | null = null;

function localRead(): Employee[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Employee[]) : [];
  } catch { return []; }
}
function localWrite(list: Employee[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("hadir:employees-changed"));
  } catch {}
}

async function pushEmployees(local: Employee[], pins?: Record<string, string>) {
  const remote = await getBackendEmployees();
  const byId = new Map(remote.map(e => [e.id, e]));
  const byJob = new Map(remote.map(e => [e.jobNumber, e]));
  const merged = [...remote];

  for (const employee of local) {
    const existing = byId.get(employee.id) || byJob.get(employee.jobNumber);
    try {
      if (!existing) {
        const pin = pins?.[employee.id];
        if (!pin) {
          if (!merged.some(e => e.id === employee.id || e.jobNumber === employee.jobNumber)) merged.push(employee);
          continue;
        }
        const result = await createBackendEmployee({ ...employee, pin });
        // Use the server representation when available, so the ID and schedule
        // stored locally are exactly the same record as D1.
        merged.push(result.employee || employee);
        continue;
      }

      const input: any = {
        jobNumber: employee.jobNumber,
        name: employee.name,
        status: employee.status,
        deviceId: employee.deviceId,
        deviceLabel: employee.deviceLabel,
        scheduleType: employee.scheduleType,
        rotationStartDate: employee.rotationStartDate,
        workStartTime: employee.workStartTime,
        workEndTime: employee.workEndTime,
        gracePeriodMinutes: employee.gracePeriodMinutes,
        role: employee.role,
        locationId: employee.locationId,
        rotationDaysOn: employee.rotationDaysOn,
        rotationDaysOff: employee.rotationDaysOff,
        specialties: employee.specialties,
        workDays: employee.workDays,
        avatar: employee.avatar,
      };
      const pin = pins?.[employee.id];
      if (pin) input.pin = pin;

      const result = await updateBackendEmployee(existing.id, input);
      if (employee.deviceId === null) await resetBackendEmployeeDevice(existing.id);
      const serverEmployee = result.employee || { ...existing, ...employee, id: existing.id };
      const index = merged.findIndex(e => e.id === existing.id);
      if (index >= 0) merged[index] = serverEmployee;
      else merged.push(serverEmployee);
    } catch (error) {
      console.warn("Hadir employee cloud sync failed; keeping local copy:", error);
      if (!merged.some(e => e.id === employee.id || e.jobNumber === employee.jobNumber)) merged.push(employee);
    }
  }
  localWrite(merged);
}

export async function syncEmployeesToCloud(localEmployees?: Employee[], pins?: Record<string, string>) {
  if (!backendEnabled || typeof window === "undefined") return;
  pending = { employees: localEmployees || localRead(), pins };
  if (running) return;

  running = true;
  try {
    while (pending) {
      const current = pending;
      pending = null;
      try {
        await pushEmployees(current.employees, current.pins);
      } catch (error) {
        console.warn("Hadir cloud employee sync deferred:", error);
      }
    }
  } finally {
    running = false;
  }
}

export async function pullEmployeesFromCloud() {
  if (!backendEnabled || typeof window === "undefined") return;
  try {
    const remote = await getBackendEmployees();
    const local = localRead();
    const localById = new Map(local.map(e => [e.id, e]));
    const localByJob = new Map(local.map(e => [e.jobNumber, e]));
    // D1 is authoritative for employee profile/schedule data. Keep only the
    // local PIN hash because it is intentionally never returned by the API.
    const merged = remote.map(r => {
      const cached = localById.get(r.id) || localByJob.get(r.jobNumber);
      return cached?.pinHash ? { ...r, pinHash: cached.pinHash } : r;
    });
    localWrite(merged);
  } catch (error) {
    console.warn("Hadir cloud pull deferred:", error);
  }
}

export async function removeEmployeeFromCloud(id: string) {
  if (!backendEnabled) return;
  try { await deleteBackendEmployee(id); } catch (error) { console.warn("Cloud delete deferred:", error); }
}
export async function resetEmployeeDeviceInCloud(id: string) {
  if (!backendEnabled) return;
  try { await resetBackendEmployeeDevice(id); } catch (error) { console.warn("Cloud device reset deferred:", error); }
}
