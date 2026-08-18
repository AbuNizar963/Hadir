import type {
  AttendanceRecord,
  AuditEntry,
  Employee,
  EmployeeRequest,
  RequestType,
  Settings,
} from "@/types";
import { hash } from "@/lib/hash";
import { generateId } from "@/lib/utils";

// Re-export types used by callers that import from this module.
export type { EmployeeRequest, RequestType } from "@/types";

/* ------------------------------------------------------------------ */
/*  Storage keys and low-level helpers                                 */
/* ------------------------------------------------------------------ */

const K = {
  EMPLOYEES: "hadir.employees",
  ATTENDANCE: "hadir.attendance",
  AUDIT: "hadir.audit",
  REQUESTS: "hadir.requests",
  SETTINGS: "hadir.settings",
  SESSION: "hadir.session",
  MANAGER_SESSION: "hadir.manager_session",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error writing to localStorage", e);
  }
}

/* ------------------------------------------------------------------ */
/*  Public generic adapter (kept for backward compatibility)           */
/* ------------------------------------------------------------------ */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  }
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing from localStorage", e);
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();

export function getStoredJSON<T>(key: string, defaultValue: T): T {
  const val = storage.getItem(key);
  if (!val) return defaultValue;
  try {
    return JSON.parse(val) as T;
  } catch {
    return defaultValue;
  }
}

export function setStoredJSON<T>(key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export const defaultSettings: Settings = {
  qrCode: "HADIR-SITE-01-STATIC",
  workSiteLat: 24.7136,
  workSiteLng: 46.6753,
  radiusMeters: 100,
  workStart: "08:00",
  workEnd: "16:00",
  lateGraceMinutes: 10,
  managerPasswordHash: hash("admin123"),
  brandName: "حاضِر",
  brandLogo: null,
  locations: [],
};

export function getSettings(): Settings {
  const s = read<Settings | null>(K.SETTINGS, null);
  if (!s) return { ...defaultSettings };
  return { ...defaultSettings, ...s };
}

export function saveSettings(next: Settings): void {
  write(K.SETTINGS, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("hadir:settings-changed"));
  }
}

/* ------------------------------------------------------------------ */
/*  Employees                                                          */
/* ------------------------------------------------------------------ */

export function getEmployees(): Employee[] {
  return read<Employee[]>(K.EMPLOYEES, []);
}

export function saveEmployees(list: Employee[]): void {
  write(K.EMPLOYEES, list);
}

export function findEmployeeByJobNumber(jobNumber: string): Employee | null {
  const list = getEmployees();
  return list.find((e) => e.jobNumber === jobNumber) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Attendance                                                         */
/* ------------------------------------------------------------------ */

export function getAttendance(): AttendanceRecord[] {
  return read<AttendanceRecord[]>(K.ATTENDANCE, []);
}

export function addAttendance(rec: AttendanceRecord): void {
  const list = getAttendance();
  list.unshift(rec);
  write(K.ATTENDANCE, list);
}

/* ------------------------------------------------------------------ */
/*  Audit log                                                          */
/* ------------------------------------------------------------------ */

export function getAudit(): AuditEntry[] {
  return read<AuditEntry[]>(K.AUDIT, []);
}

export function addAudit(entry: AuditEntry): void {
  const list = getAudit();
  list.unshift(entry);
  write(K.AUDIT, list);
}

/* ------------------------------------------------------------------ */
/*  Employee requests (permission / leave / checkout)                  */
/* ------------------------------------------------------------------ */

export function getRequests(): EmployeeRequest[] {
  return read<EmployeeRequest[]>(K.REQUESTS, []);
}

export function addRequest(
  req: Omit<EmployeeRequest, "id" | "status" | "createdAt">
): EmployeeRequest {
  const full: EmployeeRequest = {
    id: generateId(),
    status: "pending",
    createdAt: new Date().toISOString(),
    ...req,
  };
  const list = getRequests();
  list.unshift(full);
  write(K.REQUESTS, list);
  return full;
}

export function updateRequestStatus(
  id: string,
  status: "approved" | "rejected"
): void {
  const list = getRequests().map((r) =>
    r.id === id ? { ...r, status } : r
  );
  write(K.REQUESTS, list);
}

/* ------------------------------------------------------------------ */
/*  Manager manual check-in/out                                        */
/* ------------------------------------------------------------------ */

export function forceCheckInByManager(
  emp: Employee,
  type: "check-in" | "check-out"
): AttendanceRecord {
  const s = getSettings();
  const now = new Date().toISOString();
  const rec: AttendanceRecord = {
    id: generateId(),
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    employeeName: emp.name,
    type,
    timestamp: now,
    lat: s.workSiteLat,
    lng: s.workSiteLng,
    distanceMeters: 0,
    deviceId: "manager-manual",
    ip: "server-side",
    qrCode: "MANAGER-MANUAL",
    locationId: emp.locationId || "main",
  };
  addAttendance(rec);

  const auditEntry: AuditEntry = {
    id: generateId(),
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    actorName: "المدير",
    action: type,
    result: "success",
    reason: "تسجيل يدوي بواسطة المدير",
    timestamp: now,
    deviceId: "manager-manual",
    ip: "server-side",
    lat: s.workSiteLat,
    lng: s.workSiteLng,
    distanceMeters: 0,
  };
  addAudit(auditEntry);

  return rec;
}

/* ------------------------------------------------------------------ */
/*  Shift helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns true when the employee's scheduled work-end time has passed.
 * Falls back to the global settings.workEnd when the employee has no
 * explicit workEndTime configured.
 */
export function isShiftOver(emp?: Employee | null): boolean {
  const s = getSettings();
  const endStr = emp?.workEndTime || s.workEnd || "16:00";
  const [h, m] = endStr.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return true;
  const now = new Date();
  const end = new Date(now);
  end.setHours(h, m, 0, 0);
  return now.getTime() >= end.getTime();
}

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

export interface Session {
  employeeId: string;
  jobNumber: string;
  name: string;
  loginAt: string;
  role?: string;
}

export interface ManagerSession {
  loginAt: string;
  name?: string;
  role?: string;
}

export function getSession(): Session | null {
  return read<Session | null>(K.SESSION, null);
}

export function setSession(s: Session | null): void {
  if (s === null) {
    if (typeof window !== "undefined") localStorage.removeItem(K.SESSION);
    return;
  }
  write(K.SESSION, s);
}

export function getManagerSession(): ManagerSession | null {
  return read<ManagerSession | null>(K.MANAGER_SESSION, null);
}

export function setManagerSession(s: ManagerSession | null): void {
  if (s === null) {
    if (typeof window !== "undefined")
      localStorage.removeItem(K.MANAGER_SESSION);
    return;
  }
  write(K.MANAGER_SESSION, s);
}

/* ------------------------------------------------------------------ */
/*  Seed / reset                                                       */
/* ------------------------------------------------------------------ */

export function seedIfEmpty(): void {
  if (typeof window === "undefined") return;

  // Settings
  if (!localStorage.getItem(K.SETTINGS)) {
    saveSettings({ ...defaultSettings });
  }

  // Employees — create a couple of demo accounts on first launch
  if (!localStorage.getItem(K.EMPLOYEES)) {
    const now = new Date().toISOString();
    const demo: Employee[] = [
      {
        id: generateId(),
        jobNumber: "1001",
        name: "أحمد المهندس",
        pinHash: hash("1001"),
        status: "active",
        deviceId: null,
        deviceLabel: null,
        createdAt: now,
        scheduleType: "ADMIN",
        workStartTime: "08:00",
        workEndTime: "16:00",
        gracePeriodMinutes: 10,
        rotationStartDate: null,
        avatar: null,
        role: "staff",
        locationId: null,
        specialties: ["general"],
      },
      {
        id: generateId(),
        jobNumber: "1002",
        name: "سارة المشرفة",
        pinHash: hash("1002"),
        status: "active",
        deviceId: null,
        deviceLabel: null,
        createdAt: now,
        scheduleType: "ROTATION",
        rotationStartDate: now.slice(0, 10),
        rotationDaysOn: 4,
        rotationDaysOff: 4,
        workStartTime: "08:00",
        workEndTime: "20:00",
        gracePeriodMinutes: 15,
        avatar: null,
        role: "supervisor",
        locationId: null,
        specialties: ["general"],
      },
    ];
    saveEmployees(demo);
  }

  // Empty collections
  if (!localStorage.getItem(K.ATTENDANCE)) write(K.ATTENDANCE, []);
  if (!localStorage.getItem(K.AUDIT)) write(K.AUDIT, []);
  if (!localStorage.getItem(K.REQUESTS)) write(K.REQUESTS, []);
}

export function resetAll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K.EMPLOYEES);
  localStorage.removeItem(K.ATTENDANCE);
  localStorage.removeItem(K.AUDIT);
  localStorage.removeItem(K.REQUESTS);
  localStorage.removeItem(K.SETTINGS);
  localStorage.removeItem(K.SESSION);
  localStorage.removeItem(K.MANAGER_SESSION);
  seedIfEmpty();
}
