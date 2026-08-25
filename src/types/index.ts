export type EmployeeStatus = "active" | "suspended";
export type ScheduleType = "ADMIN" | "ROTATION";
export type UserRole = "owner" | "admin" | "manager" | "supervisor" | "staff";
export type RequestType = "permission" | "leave" | "checkout";
export type EscapeStatus = "escaped" | "returned";

export interface EmployeeRequest { id: string; employeeId: string; employeeName: string; jobNumber: string; type: RequestType; reason?: string; status: "pending" | "approved" | "rejected"; createdAt: string; }
export interface Location { id: string; name: string; lat: number; lng: number; radiusMeters: number; }
export interface AdminAccount { id: string; username: string; passwordHash: string; name: string; role: "owner" | "manager" | "supervisor"; active: boolean; createdAt: string; }

export interface Employee {
  id: string; jobNumber: string; name: string; pinHash: string; status: EmployeeStatus;
  deviceId: string | null; deviceLabel: string | null; createdAt: string;
  scheduleType?: ScheduleType; rotationStartDate?: string | null; avatar?: string | null;
  workStartTime?: string; workEndTime?: string;
  rotationStartTime?: string; rotationEndTime?: string;
  gracePeriodMinutes?: number;
  role?: UserRole; locationId?: string | null; rotationDaysOn?: number; rotationDaysOff?: number;
  workDays?: number[];
  specialties?: string[];
}

export interface AttendanceRecord { id: string; employeeId: string; jobNumber: string; employeeName: string; type: "check-in" | "check-out"; timestamp: string; lat: number; lng: number; distanceMeters: number; deviceId: string; ip: string; qrCode: string; locationId?: string; }
export interface EscapeEvent { id: string; employeeId: string; jobNumber: string; employeeName: string; status: EscapeStatus; timestamp: string; reason?: string | null; actorId?: string | null; actorName?: string | null; lat?: number | null; lng?: number | null; createdAt: string; }
export type AuditResult = "success" | "rejected";
export interface AuditEntry {
  id: string; employeeId: string | null; jobNumber: string; actorName: string;
  action: "login" | "login-failed" | "check-in" | "check-out" | "device-bound" | "manager-login" | "manager-login-failed" | "supervisor-login" | "supervisor-login-failed" | "owner-login" | "owner-login-failed" | "admin-login" | "admin-login-failed";
  result: AuditResult; reason?: string; timestamp: string; deviceId: string; ip: string; lat?: number; lng?: number; distanceMeters?: number;
}

export interface Settings { qrCode: string; workSiteLat: number; workSiteLng: number; radiusMeters: number; workStart: string; workEnd: string; lateGraceMinutes: number; ownerUsername?: string; ownerPasswordHash?: string; ownerName?: string; managerUsername?: string; managerPasswordHash: string; managerName?: string; supervisorUsername?: string; supervisorPasswordHash?: string; supervisorName?: string; adminAccounts?: AdminAccount[]; brandLogo?: string | null; brandName?: string; locations?: Location[]; }