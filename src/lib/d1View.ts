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

const state: D1View = { employees: [], attendance: [], requests: [], audit: [], settings: null, locations: [], admins: [], loadedAt: null };

export function setD1View(patch: Partial<D1View>) { Object.assign(state, patch, { loadedAt: new Date().toISOString() }); if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:d1-view-changed")); }
export function getD1View() { return state; }
export function clearD1View() { state.employees=[]; state.attendance=[]; state.requests=[]; state.audit=[]; state.settings=null; state.locations=[]; state.admins=[]; state.loadedAt=null; }
