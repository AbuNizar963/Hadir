import {
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
  success: boolean;
  reason?: string;
  needsDeviceBinding?: boolean;
}

export function loginEmployee(jobNumber: string, pin: string): LoginResult {
  const trimmedJobNum = jobNumber.trim();
  const employees = getEmployees();
  
  const emp = employees.find(
    (e) => String(e.jobNumber).trim() === trimmedJobNum || String(e.id) === trimmedJobNum
  );

  if (!emp) {
    log({
      employeeId: null,
      jobNumber,
      actorName: "-",
      action: "login-failed",
      result: "rejected",
      reason: "الرقم الوظيفي غير موجود",
    });
    return { ok: false, success: false, reason: "الرقم الوظيفي أو كلمة المرور غير صحيحة" };
  }

  if (emp.status && emp.status !== "active") {
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

  const isPinValid =
    verify(pin, emp.pinHash) ||
    pin === emp.pinHash ||
    pin === (emp as any).pin ||
    pin === (emp as any).password;

  if (!isPinValid) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: "login-failed",
      result: "rejected",
      reason: "كلمة المرور خاطئة",
    });
    return { ok: false, success: false, reason: "الرقم الوظيفي أو كلمة المرور غير صحيحة" };
  }

  const deviceId = getDeviceId();

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
      success: false,
      reason: "هذا الجهاز غير موثّق لحسابك. يرجى مراجعة الإدارة لإلغاء ربط الجهاز السابق.",
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
  return { ok: true, success: true };
}

export function logoutEmployee() {
  setSession(null);
}

// دالة تسجيل دخول الإدارة المحدثة (تدعم المالك، المدير، والمشرف بناءً على اسم المستخدم وكلمة المرور)
export function loginManager(password: string, username?: string): LoginResult {
  const s = getSettings();
  
  const inputUser = (username || "").trim();
  const inputPass = password;

  let matchedRole: "owner" | "manager" | "supervisor" | null = null;
  let actorTitle = "المدير";

  // 1. التحقق إذا كان المستخدم هو المالك (owner)
  const isOwnerUser = !inputUser || inputUser === s.ownerUsername || inputUser.toLowerCase() === "owner";
  const isOwnerPass = verify(inputPass, s.ownerPasswordHash) || inputPass === s.ownerPasswordHash || (!s.ownerPasswordHash && inputPass === "admin"); // افتراضي
  
  if (isOwnerUser && isOwnerPass) {
    matchedRole = "owner";
    actorTitle = "المالك";
  } 
  // 2. التحقق إذا كان المستخدم هو المدير (manager)
  else {
    const isManagerUser = !inputUser || inputUser === s.managerUsername || inputUser.toLowerCase() === "manager";
    const isManagerPass = verify(inputPass, s.managerPasswordHash) || inputPass === s.managerPasswordHash;
    
    if (isManagerUser && isManagerPass) {
      matchedRole = "manager";
      actorTitle = "المدير";
    } 
    // 3. التحقق إذا كان المستخدم هو المشرف (supervisor)
    else {
      const isSupervisorUser = !inputUser || inputUser === s.supervisorUsername || inputUser.toLowerCase() === "supervisor";
      const isSupervisorPass = verify(inputPass, s.supervisorPasswordHash) || inputPass === s.supervisorPasswordHash;
      
      if (isSupervisorUser && isSupervisorPass) {
        matchedRole = "supervisor";
        actorTitle = "المشرف";
      }
    }
  }

  if (!matchedRole) {
    log({
      employeeId: null,
      jobNumber: "-",
      actorName: inputUser || "إدارة",
      action: "manager-login-failed",
      result: "rejected",
      reason: "اسم المستخدم أو كلمة المرور خاطئة",
    });
    return { ok: false, success: false, reason: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }

  // حفظ الجلسة مع الدور المكتشف
  setManagerSession({
    loginAt: new Date().toISOString(),
    role: matchedRole,
    jobNumber: inputUser || matchedRole,
  });

  log({
    employeeId: null,
    jobNumber: inputUser || "-",
    actorName: actorTitle,
    action: "manager-login",
    result: "success",
  });

  return { ok: true, success: true };
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
  role: "owner" | "manager" | "supervisor" | "staff";
  name?: string;
  loginAt?: string;
  jobNumber?: string;
};

export function getCurrentUser(): CurrentUser | null {
  const m = getManagerSession() as any;
  if (m) {
    return {
      role: m.role || "manager",
      name: m.role === "owner" ? "المالك" : m.role === "supervisor" ? "المشرف" : "المدير",
      loginAt: m.loginAt,
      jobNumber: m.jobNumber,
    };
  }
  const s = getSession();
  if (s) return { role: "staff", name: s.name, loginAt: s.loginAt, jobNumber: s.jobNumber };
  return null;
}
