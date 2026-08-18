import {
  findEmployeeByJobNumber,
  getManagerSession,
  getSession,
  getSettings,
  saveEmployees,
  getEmployees,
  setManagerSession,
  setSession,
} from "@/lib/storage";
import { verify } from "@/lib/hash";
import { getDeviceId, getDeviceLabel } from "@/lib/device";
import { log } from "@/lib/audit";

export interface LoginResult {
  ok: boolean;
  reason?: string;
  needsDeviceBinding?: boolean;
}

export function loginEmployee(jobNumber: string, pin: string): LoginResult {
  const emp = findEmployeeByJobNumber(jobNumber.trim());
  if (!emp) {
    log({
      employeeId: null,
      jobNumber,
      actorName: "-",
      action: "login-failed",
      result: "rejected",
      reason: "الرقم الوظيفي غير موجود",
    });
    return { ok: false, reason: "الرقم الوظيفي أو كلمة المرور غير صحيحة" };
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
    return { ok: false, reason: "الحساب موقوف. يرجى مراجعة المدير" };
  }
  if (!verify(pin, emp.pinHash)) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "login-failed",
      result: "rejected",
      reason: "كلمة المرور خاطئة",
    });
    return { ok: false, reason: "الرقم الوظيفي أو كلمة المرور غير صحيحة" };
  }

  const deviceId = getDeviceId();

  // First-time device binding
  if (!emp.deviceId) {
    const list = getEmployees();
    const idx = list.findIndex((e) => e.id === emp.id);
    if (idx >= 0) {
      list[idx].deviceId = deviceId;
      list[idx].deviceLabel = getDeviceLabel();
      saveEmployees(list);
    }
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "device-bound",
      result: "success",
      reason: `تم ربط الجهاز: ${getDeviceLabel()}`,
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
      reason:
        "هذا الجهاز غير موثّق لحسابك. يرجى مراجعة المدير لإلغاء ربط الجهاز السابق.",
    };
  }

  setSession({
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    name: emp.name,
    loginAt: new Date().toISOString(),
  });
  log({
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    actorName: emp.name,
    action: "login",
    result: "success",
  });
  return { ok: true };
}

export function logoutEmployee() {
  setSession(null);
}

export function loginManager(password: string): LoginResult {
  const s = getSettings();
  if (!verify(password, s.managerPasswordHash)) {
    log({
      employeeId: null,
      jobNumber: "-",
      actorName: "المدير",
      action: "manager-login-failed",
      result: "rejected",
      reason: "كلمة مرور خاطئة",
    });
    return { ok: false, reason: "كلمة المرور غير صحيحة" };
  }
  setManagerSession({ loginAt: new Date().toISOString() });
  log({
    employeeId: null,
    jobNumber: "-",
    actorName: "المدير",
    action: "manager-login",
    result: "success",
  });
  return { ok: true };
}

export function logoutManager() {
  setManagerSession(null);
}

export function currentSession() {
  return getSession();
}
export function currentManager() {
  return getManagerSession();
}

export type CurrentUser = {
  role: "manager" | "supervisor" | "staff";
  name?: string;
  loginAt?: string;
};

/**
 * Returns the currently-authenticated user for the app.
 * - If a manager session exists → role: "manager".
 * - Else if an employee session exists → role: "staff".
 * - Otherwise null.
 * Supervisor role is reserved for a future dedicated session.
 */
export function getCurrentUser(): CurrentUser | null {
  const m = getManagerSession();
  if (m) return { role: "manager", name: "المدير", loginAt: m.loginAt };
  const s = getSession();
  if (s) return { role: "staff", name: s.name, loginAt: s.loginAt };
  return null;
}
