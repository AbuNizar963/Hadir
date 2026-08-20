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
    window.dispatchEvent(new Event("hadir:cloud-data-changed"));
  } catch {}
}

function scheduleFields(employee: Employee) {
  const rotation = employee.scheduleType === "ROTATION";
  return {
    scheduleType: rotation ? "ROTATION" : "ADMIN",
    rotationStartDate: rotation ? (employee.rotationStartDate || null) : null,
    workStartTime: rotation ? "00:00" : (employee.workStartTime || "08:00"),
    workEndTime: rotation ? "00:00" : (employee.workEndTime || "16:00"),
    rotationDaysOn: rotation ? Math.max(1, Math.floor(employee.rotationDaysOn ?? 4)) : null,
    rotationDaysOff: rotation ? Math.max(0, Math.floor(employee.rotationDaysOff ?? 4)) : null,
    workDays: rotation ? undefined : employee.workDays,
  };
}

async function persistEmployeeSchedule(id: string, employee: Employee) {
  const fields = scheduleFields(employee);
  const result = await updateBackendEmployee(id, fields);
  const server = result.employee;
  // Never accept an ADMIN response when the manager explicitly selected ROTATION.
  // This protects against stale workers/API deployments and makes the mismatch retryable.
  if (employee.scheduleType === "ROTATION" && server?.scheduleType !== "ROTATION") {
    const retry = await updateBackendEmployee(id, fields);
    if (retry.employee?.scheduleType !== "ROTATION") {
      throw new Error("تعذر حفظ نظام الدوام التناوبي في قاعدة D1");
    }
    return retry.employee;
  }
  return server;
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
        const result = await createBackendEmployee({
          ...employee,
          ...scheduleFields(employee),
          pin,
        });
        let serverEmployee = result.employee || employee;
        if (employee.scheduleType === "ROTATION" && serverEmployee.scheduleType !== "ROTATION") {
          serverEmployee = await persistEmployeeSchedule(serverEmployee.id, employee);
        }
        merged.push(serverEmployee);
        continue;
      }

      const input: any = {
        jobNumber: employee.jobNumber,
        name: employee.name,
        status: employee.status,
        deviceId: employee.deviceId,
        deviceLabel: employee.deviceLabel,
        ...scheduleFields(employee),
        gracePeriodMinutes: employee.gracePeriodMinutes,
        role: employee.role,
        locationId: employee.locationId,
        specialties: employee.specialties,
        avatar: employee.avatar,
      };
      const pin = pins?.[employee.id];
      if (pin) input.pin = pin;

      const result = await updateBackendEmployee(existing.id, input);
      let serverEmployee = result.employee || { ...existing, ...employee, id: existing.id };
      if (employee.scheduleType === "ROTATION" && serverEmployee.scheduleType !== "ROTATION") {
        serverEmployee = await persistEmployeeSchedule(existing.id, employee);
      }
      const index = merged.findIndex(e => e.id === existing.id);
      if (index >= 0) merged[index] = serverEmployee;
      else merged.push(serverEmployee);
    } catch (error) {
      console.warn("Hadir employee cloud sync failed; keeping local copy:", error);
      const index = merged.findIndex(e => e.id === employee.id || e.jobNumber === employee.jobNumber);
      if (index >= 0) {
        // Keep the manager's selected schedule locally instead of replacing it with
        // a stale ADMIN copy when the cloud write has not completed yet.
        merged[index] = { ...merged[index], ...employee };
      } else {
        merged.push(employee);
      }
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
