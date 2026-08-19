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
import { getDeviceId, getClientIpPlaceholder } from "@/lib/device";

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
  } catch (error) {
    console.error("Error writing to localStorage", error);
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
  ownerPasswordHash: hash("963"),
  ownerName: "المالك",
  managerUsername: "",
  managerPasswordHash: "",
  managerName: "",
  supervisorUsername: "",
  supervisorPasswordHash: "",
  supervisorName: "",
  brandName: "حاضِر",
  brandLogo: null,
  locations: [],
};

export function getSettings(): Settings {
  const stored = read<Partial<Settings> | null>(K.SETTINGS, null);
  return { ...defaultSettings, ...(stored ?? {}) };
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

export function addAttendance(record: AttendanceRecord): void {
  const list = getAttendance();
  list.unshift(record);
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
  request: Omit<EmployeeRequest, "id" | "status" | "createdAt">
): EmployeeRequest {
  const full: EmployeeRequest = {
    ...request,
    id: generateId(),
    status: "pending",
    createdAt: new Date().toISOString(),
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
  const list = getRequests().map((request) =>
    request.id === id ? { ...request, status } : request
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
  jobNumber?: string;
}

export function getSession(): Session | null {
  return read<Session | null>(K.SESSION, null);
}

export function setSession(session: Session | null): void {
  if (session === null) {
    if (typeof window !== "undefined") localStorage.removeItem(K.SESSION);
    return;
  }
  write(K.SESSION, session);
}

export function getManagerSession(): ManagerSession | null {
  return read<ManagerSession | null>(K.MANAGER_SESSION, null);
}

export function setManagerSession(session: ManagerSession | null): void {
  if (session === null) {
    if (typeof window !== "undefined") localStorage.removeItem(K.MANAGER_SESSION);
    return;
  }
  write(K.MANAGER_SESSION, session);
}

export function seedIfEmpty(): void {
  if (typeof window === "undefined") return;

  const settings = getSettings();
  saveSettings(settings);
  const now = new Date().toISOString();
  const existing = getEmployees();
  const previousOwner = existing.find(
    (employee) => employee.role === "owner" || employee.jobNumber === settings.ownerUsername
  );

  const owner: Employee = {
    id: previousOwner?.id || "owner-account",
    jobNumber: settings.ownerUsername || "AbuNizar",
    name: settings.ownerName || "المالك",
    pinHash: settings.ownerPasswordHash || hash("963"),
    status: previousOwner?.status || "active",
    deviceId: previousOwner?.deviceId || null,
    deviceLabel: previousOwner?.deviceLabel || null,
    createdAt: previousOwner?.createdAt || now,
    scheduleType: "ADMIN",
    workStartTime: settings.workStart,
    workEndTime: settings.workEnd,
    gracePeriodMinutes: settings.lateGraceMinutes,
    rotationStartDate: null,
    avatar: previousOwner?.avatar || null,
    role: "owner",
    locationId: previousOwner?.locationId || null,
    specialties: ["executive"],
  };

  if (existing.length === 0) {
    saveEmployees([
      {
        id: generateId(),
        jobNumber: "1001",
        name: "أحمد الموظف",
        pinHash: hash("1001"),
        status: "active",
        deviceId: null,
        deviceLabel: null,
        createdAt: now,
        scheduleType: "ADMIN",
        workStartTime: settings.workStart,
        workEndTime: settings.workEnd,
        gracePeriodMinutes: settings.lateGraceMinutes,
        rotationStartDate: null,
        role: "staff",
        locationId: null,
        specialties: ["general"],
      },
      owner,
    ]);
  } else {
    const list = existing.filter(
      (employee) => employee.id !== previousOwner?.id && employee.role !== "owner"
    );
    saveEmployees([...list, owner]);
  }

  if (!localStorage.getItem(K.ATTENDANCE)) write<AttendanceRecord[]>(K.ATTENDANCE, []);
  if (!localStorage.getItem(K.AUDIT)) write<AuditEntry[]>(K.AUDIT, []);
  if (!localStorage.getItem(K.REQUESTS)) write<EmployeeRequest[]>(K.REQUESTS, []);
}

export function resetAll(): void {
  if (typeof window === "undefined") return;
  Object.values(K).forEach((key) => localStorage.removeItem(key));
  seedIfEmpty();
}

export function findEmployeeByJobNumber(jobNumber: string): Employee | undefined {
  const normalized = jobNumber.trim();
  return getEmployees().find((employee) => employee.jobNumber.trim() === normalized);
}

function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function isShiftOver(employee?: Employee): boolean {
  const settings = getSettings();
  const time = parseTime(employee?.workEndTime || settings.workEnd);
  if (!time) return false;

  const now = new Date();
  const end = new Date(now);
  end.setHours(time.hours, time.minutes, 0, 0);
  return now.getTime() >= end.getTime();
}

export function forceCheckInByManager(
  employeeOrId: Employee | string,
  type: "check-in" | "check-out" | "checkIn" | "checkOut"
): AttendanceRecord | null {
  const employee = typeof employeeOrId === "string"
    ? getEmployees().find((item) => item.id === employeeOrId)
    : getEmployees().find((item) => item.id === employeeOrId.id);

  if (!employee) return null;

  const normalizedType: "check-in" | "check-out" =
    type === "checkIn" ? "check-in" : type === "checkOut" ? "check-out" : type;

  const record: AttendanceRecord = {
    id: generateId(),
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    employeeName: employee.name,
    type: normalizedType,
    timestamp: new Date().toISOString(),
    lat: 0,
    lng: 0,
    distanceMeters: 0,
    deviceId: employee.deviceId || getDeviceId(),
    ip: getClientIpPlaceholder(),
    qrCode: "MANUAL",
    locationId: employee.locationId || "main",
  };

  addAttendance(record);
  return record;
}
