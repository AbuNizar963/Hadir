import type { AttendanceRecord, Employee, EmployeeRequest, Settings, Location, AuditEntry, AdminAccount } from "@/types";

export type D1View = {
  employees: Employee[];
  attendance: AttendanceRecord[];
  requests: EmployeeRequest[];
  audit: AuditEntry[];
  settings: Settings | null;
  locations: Location[];
  admins: AdminAccount[];
  loadedAt: string | null;
};

const state: D1View = { 
  employees: [], 
  attendance: [], 
  requests: [], 
  audit: [], 
  settings: null, 
  locations: [], 
  admins: [], 
  loadedAt: null 
};

function stableValue(value: unknown): string {
  try { 
    return JSON.stringify(value); 
  } catch { 
    return String(value); 
  }
}

export function setD1View(patch: Partial<D1View>) {
  let changed = false;
  for (const key of Object.keys(patch) as Array<keyof D1View>) {
    if (key === "loadedAt") continue;
    if (stableValue(state[key]) !== stableValue(patch[key])) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  Object.assign(state, patch, { loadedAt: new Date().toISOString() });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hadir:d1-view-changed", { detail: patch }));
  }
}

export function getD1View() { 
  return state; 
}

export function clearD1View() {
  const hadData = state.employees.length || state.attendance.length || state.requests.length || state.audit.length || state.settings !== null || state.locations.length || state.admins.length;
  state.employees = [];
  state.attendance = [];
  state.requests = [];
  state.audit = [];
  state.settings = null;
  state.locations = [];
  state.admins = [];
  state.loadedAt = null;
  if (hadData && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hadir:d1-view-cleared"));
  }
}

export function subscribeD1View(listener: (event: Event) => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hadir:d1-view-changed", listener);
  return () => window.removeEventListener("hadir:d1-view-changed", listener);
}
