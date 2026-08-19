import {
  getEmployees,
  getManagerSession,
  getSession,
  getSettings,
  saveEmployees,
  setManagerSession,
  setSession,
} from "@/lib/storage";
import { verify } from "@/lib/hash";
import { getDeviceId, getDeviceLabel } from "@/lib/device";
import { log } from "@/lib/audit";

export interface LoginResult {
  ok: boolean;
  success: boolean;
  reason?: string;
  needsDeviceBinding?: boolean;
}

function normalize(value: string): string {
  return value.trim();
}

export function loginEmployee(jobNumber: string, pin: string): LoginResult {
  const username = normalize(jobNumber);
  const employees = getEmployees();
  const emp = employees.find(
    (employee) => employee.jobNumber.trim() === username || employee.id === username
  );

  if (!emp) {
    log({
      employeeId: null,
      jobNumber: username,
      actorName: "-",
      action: "login-failed",
      result: "rejected",
      reason: "الرقم الوظيفي غير موجود",
    });
    return { ok: false, success: false, reason: "الرقم الوظيفي أو رمز الدخول غير صحيح" };
  }

  if (emp.status !== "active") {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "login-failed",
      result: "rejected",
      reason: "الحساب موقوف",
    });
    return { ok: false, success: false, reason: "الحساب موقوف. يرجى مراجعة الإدارة" };
  }

  // Never accept a stored hash, legacy plaintext field, or a hard-coded password as the PIN.
  if (!pin || !emp.pinHash || !verify(pin, emp.pinHash)) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "login-failed",
      result: "rejected",
      reason: "رمز الدخول خاطئ",
    });
    return { ok: false, success: false, reason: "الرقم الوظيفي أو رمز الدخول غير صحيح" };
  }

  const deviceId = getDeviceId();
  const deviceLabel = getDeviceLabel();

  if (!emp.deviceId) {
    const index = employees.findIndex((employee) => employee.id === emp.id);
    if (index >= 0) {
      employees[index] = {
        ...employees[index],
        deviceId,
        deviceLabel,
      };
      saveEmployees(employees);
    }

    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "device-bound",
      result: "success",
      reason: `تم ربط الجهاز: ${deviceLabel}`,
    });
  } else if (emp.deviceId !== deviceId) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "login-failed",
      result: "rejected",
      reason: "محاولة تسجيل دخول من جهاز غير موثّق",
    });
    return {
      ok: false,
      success: false,
      reason: "هذا الجهاز غير موثّق لحسابك. يرجى مراجعة الإدارة لإلغاء ربط الجهاز السابق.",
    };
  }

  setSession({
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    name: emp.name,
    loginAt: new Date().toISOString(),
    role: emp.role,
  });

  log({
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    actorName: emp.name,
    action: "login",
    result: "success",
  });

  return { ok: true, success: true };
}

export function logoutEmployee(): void {
  setSession(null);
}

export function loginManager(password: string, username: string): LoginResult {
  const settings = getSettings();
  const inputUser = normalize(username);
  const inputPassword = password;

  if (!inputUser || !inputPassword) {
    return { ok: false, success: false, reason: "اسم المستخدم وكلمة المرور مطلوبان" };
  }

  const candidates: Array<{
    username?: string;
    passwordHash?: string;
    role: "owner" | "manager" | "supervisor";
    name: string;
  }> = [
    {
      username: settings.ownerUsername,
      passwordHash: settings.ownerPasswordHash,
      role: "owner",
      name: settings.ownerName || "المالك",
    },
    {
      username: settings.managerUsername,
      passwordHash: settings.managerPasswordHash,
      role: "manager",
      name: settings.managerName || "المدير",
    },
    {
      username: settings.supervisorUsername,
      passwordHash: settings.supervisorPasswordHash,
      role: "supervisor",
      name: settings.supervisorName || "المشرف",
    },
  ];

  const matched = candidates.find(
    (candidate) =>
      Boolean(candidate.username) &&
      candidate.username!.trim() === inputUser &&
      Boolean(candidate.passwordHash) &&
      verify(inputPassword, candidate.passwordHash!)
  );

  if (!matched) {
    log({
      employeeId: null,
      jobNumber: inputUser,
      actorName: inputUser,
      action: "manager-login-failed",
      result: "rejected",
      reason: "اسم المستخدم أو كلمة المرور خاطئة",
    });
    return { ok: false, success: false, reason: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }

  setManagerSession({
    loginAt: new Date().toISOString(),
    name: matched.name,
    role: matched.role,
    jobNumber: inputUser,
  });

  log({
    employeeId: null,
    jobNumber: inputUser,
    actorName: matched.name,
    action: "manager-login",
    result: "success",
  });

  return { ok: true, success: true };
}

export function logoutManager(): void {
  setManagerSession(null);
}

export function currentSession() {
  return getSession();
}

export function currentManager() {
  return getManagerSession();
}

export type CurrentUser = {
  role: "owner" | "manager" | "supervisor" | "staff";
  name?: string;
  loginAt?: string;
  jobNumber?: string;
};

export function getCurrentUser(): CurrentUser | null {
  const manager = getManagerSession();
  if (manager) {
    const role = manager.role === "owner" || manager.role === "manager" || manager.role === "supervisor"
      ? manager.role
      : "manager";
    return {
      role,
      name: manager.name,
      loginAt: manager.loginAt,
      jobNumber: manager.jobNumber,
    };
  }

  const employee = getSession();
  if (employee) {
    return {
      role: "staff",
      name: employee.name,
      loginAt: employee.loginAt,
      jobNumber: employee.jobNumber,
    };
  }

  return null;
}
