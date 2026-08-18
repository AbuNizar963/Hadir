export type EmployeeStatus = "active" | "suspended";

export type ScheduleType = "ADMIN" | "ROTATION";

// تحديث الأدوار لتشمل المالك (owner) والمدير (manager) والمشرف (supervisor) والموظف (staff) والإداري (admin)
export type UserRole = "owner" | "admin" | "manager" | "supervisor" | "staff";

// أنواع طلبات الموظفين (استئذان / إجازة / انصراف)
export type RequestType = "permission" | "leave" | "checkout";

// واجهة تعريف طلب الموظف
export interface EmployeeRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  jobNumber: string;
  type: RequestType;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// واجهة تعريف موقع العمل المتعدد
export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface Employee {
  id: string;
  jobNumber: string;
  name: string;
  pinHash: string;
  status: EmployeeStatus;
  deviceId: string | null;
  deviceLabel: string | null;
  createdAt: string;
  // Existing scheduling fields
  scheduleType?: ScheduleType;
  rotationStartDate?: string | null;
  avatar?: string | null;

  // Per-employee work hours and late grace period
  workStartTime?: string;
  workEndTime?: string;
  gracePeriodMinutes?: number;

  // New optional fields to support rotation patterns and roles
  role?: UserRole;
  
  // ربط الموظف بموقع عمل محدد من القائمة
  locationId?: string | null;

  // rotationDaysOn / rotationDaysOff allow defining 4/4, 3/3, 2/2 or custom patterns
  rotationDaysOn?: number;
  rotationDaysOff?: number;
  // specialties (e.g., department names or ids) — useful for per-specialty rotations
  specialties?: string[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  jobNumber: string;
  employeeName: string;
  type: "check-in" | "check-out";
  timestamp: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  deviceId: string;
  ip: string;
  qrCode: string;
  locationId?: string; // الموقع الذي تم التسجيل فيه
}

export type AuditResult = "success" | "rejected";

export interface AuditEntry {
  id: string;
  employeeId: string | null;
  jobNumber: string;
  actorName: string;
  action:
    | "login"
    | "login-failed"
    | "check-in"
    | "check-out"
    | "device-bound"
    | "manager-login"
    | "manager-login-failed"
    | "supervisor-login"
    | "supervisor-login-failed"
    | "owner-login"
    | "owner-login-failed"
    | "admin-login"
    | "admin-login-failed";
  result: AuditResult;
  reason?: string;
  timestamp: string;
  deviceId: string;
  ip: string;
  lat?: number;
  lng?: number;
  distanceMeters?: number;
}

export interface Settings {
  qrCode: string; // قيمة رمز الـ QR اليومي الثابتة أو المتغيرة
  workSiteLat: number;
  workSiteLng: number;
  radiusMeters: number;
  workStart: string; // "08:00"
  workEnd: string; // "16:00"
  lateGraceMinutes: number;
  
  // بيانات الاعتماد للأدوار الإدارية الجديدة
  ownerUsername?: string;
  ownerPasswordHash?: string;
  ownerName?: string;

  managerUsername?: string;
  managerPasswordHash: string;
  managerName?: string;

  supervisorUsername?: string;
  supervisorPasswordHash?: string;
  supervisorName?: string;

  brandLogo?: string | null;
  brandName?: string;
  // قائمة المواقع المتاحة في الشركة
  locations?: Location[];
}
