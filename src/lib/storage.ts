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

export type { EmployeeRequest, RequestType } from "@/types";

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

export const defaultSettings: Settings = {
  qrCode: "HADIR-SITE-01-STATIC",
  workSiteLat: 24.7136,
  workSiteLng: 46.6753,
  radiusMeters: 100,
  workStart: "08:00",
  workEnd: "16:00",
  lateGraceMinutes: 10,
  
  ownerUsername: "AbuNizar",
  ownerPasswordHash: hash("963963963"),
  ownerName: "المالك",

  managerUsername: "manager",
  managerPasswordHash: hash("manager123"),
  managerName: "مدير عام",

  supervisorUsername: "supervisor",
  supervisorPasswordHash: hash("super123"),
  supervisorName: "المشرف",

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

export function getEmployees(): Employee[] {
  return read<Employee[]>(K.EMPLOYEES, []);
}

export function saveEmployees(list: Employee[]): void {
  write(K.EMPLOYEES, list);
}

export function getAttendance(): AttendanceRecord[] {
  return read<AttendanceRecord[]>(K.ATTENDANCE, []);
}

export function addAttendance(rec: AttendanceRecord): void {
  const list = getAttendance();
  list.unshift(rec);
  write(K.ATTENDANCE, list);
}

export function getAudit(): AuditEntry[] {
  return read<AuditEntry[]>(K.AUDIT, []);
}

export function addAudit(entry: AuditEntry): void {
  const list = getAudit();
  list.unshift(entry);
  write(K.AUDIT, list);
}

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

export function seedIfEmpty(): void {
  if (typeof window === "undefined") return;

  const currentSettings = read<Settings | null>(K.SETTINGS, null);
  if (!currentSettings) {
    saveSettings({ ...defaultSettings });
  }

  const now = new Date().toISOString();
  const coreRoles: Employee[] = [
    {
      id: "demo-manager",
      jobNumber: "manager",
      name: "مدير عام",
      pinHash: hash("manager123"),
      status: "active",
      deviceId: null,
      deviceLabel: null,
      createdAt: now,
      scheduleType: "ADMIN",
      workStartTime: "08:00",
      workEndTime: "16:00",
      gracePeriodMinutes: 10,
      avatar: null,
      role: "manager",
      locationId: null,
      specialties: ["management"],
    },
    {
      id: "demo-owner",
      jobNumber: "AbuNizar",
      name: "مالك الشركة",
      pinHash: hash("963963963"),
      status: "active",
      deviceId: null,
      deviceLabel: null,
      createdAt: now,
      scheduleType: "ADMIN",
      workStartTime: "08:00",
      workEndTime: "16:00",
      gracePeriodMinutes: 10,
      avatar: null,
      role: "owner",
      locationId: null,
      specialties: ["executive"],
    },
    {
      id: "demo-supervisor",
      jobNumber: "supervisor",
      name: "المشرف",
      pinHash: hash("super123"),
      status: "active",
      deviceId: null,
      deviceLabel: null,
      createdAt: now,
      scheduleType: "ADMIN",
      workStartTime: "08:00",
      workEndTime: "16:00",
      gracePeriodMinutes: 10,
      avatar: null,
      role: "supervisor",
      locationId: null,
      specialties: ["support"],
    },
  ];

  const existingEmployees = getEmployees();
  if (existingEmployees.length === 0) {
    // إذا كانت القائمة فارغة تماماً، نضيف الحسابات الأساسية مع موظف تجريبي أول
    const initialList: Employee[] = [
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
        avatar: null,
        role: "staff",
        locationId: null,
        specialties: ["general"],
      },
      ...coreRoles,
    ];
    saveEmployees(initialList);
  } else {
    // التأكد من وجود الحسابات السيادية الأساسية فقط دون المساس بالموظفين الجدد الذين أضافهم المدير
    let updated = [...existingEmployees];
    for (const core of coreRoles) {
      const exists = updated.find((e) => e.jobNumber === core.jobNumber || e.role === core.role);
      if (!exists) {
        updated.push(core);
      }
    }
    saveEmployees(updated);
  }

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
  localStorage.removeItem("managerAuth");
  seedIfEmpty();
}

export function findEmployeeByJobNumber(jobNumber: string): Employee | undefined {
  const employees = getEmployees();
  return employees.find((e) => e.jobNumber.trim() === jobNumber.trim());
}

export function isShiftOver(): boolean {
  return false;
}

export function forceCheckInByManager(employeeId: string, type: "checkIn" | "checkOut"): void {
  const now = new Date().toISOString();
  const records = getAttendance();
  records.unshift({
    id: generateId(),
    employeeId,
    timestamp: now,
    type,
    method: "manual",
    lat: 0,
    lng: 0,
    status: "ontime",
  });
  write(K.ATTENDANCE, records);
}
