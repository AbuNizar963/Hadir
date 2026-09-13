import {
  getEmployees,
  getManagerSession,
  getSession,
  getSettings,
  setManagerSession,
  setSession,
} from "@/lib/storage";
import { verify } from "@/lib/hash";
import { log } from "@/lib/audit";
import { backendLogout } from "@/lib/backend";
import { revokeServerSession } from "@/lib/serverSession";

export interface LoginResult {
  ok: boolean;
  success: boolean;
  reason?: string;
}

const normalize = (value: string) => value.trim();
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";

function savedToken(role: "admin" | "employee"): string {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem(
      role === "admin" ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY,
    ) || ""
  );
}

/**
 * Legacy local authentication is retained only for compatibility with the
 * offline employee UI. Production employee authentication must use
 * backendEmployeeLogin, which validates the employee against Cloudflare D1.
 */
export function loginEmployee(jobNumber: string, pin: string): LoginResult {
  const username = normalize(jobNumber);
  const employees = getEmployees();
  const employee = employees.find(
    (candidate) =>
      candidate.jobNumber.trim() === username || candidate.id === username,
  );

  if (!employee) {
    log({
      employeeId: null,
      jobNumber: username,
      actorName: "-",
      action: "login-failed",
      result: "rejected",
      reason: "الرقم الوظيفي غير موجود محليًا",
    });
    return {
      ok: false,
      success: false,
      reason:
        "بيانات الموظف تتم إدارتها من قاعدة D1. استخدم تسجيل الدخول المتصل.",
    };
  }

  if (employee.status !== "active") {
    log({
      employeeId: employee.id,
      jobNumber: employee.jobNumber,
      actorName: employee.name,
      action: "login-failed",
      result: "rejected",
      reason: "الحساب موقوف",
    });
    return {
      ok: false,
      success: false,
      reason: "الحساب موقوف. يرجى مراجعة الإدارة",
    };
  }

  if (!pin || !employee.pinHash || !verify(pin, employee.pinHash)) {
    log({
      employeeId: employee.id,
      jobNumber: employee.jobNumber,
      actorName: employee.name,
      action: "login-failed",
      result: "rejected",
      reason: "رمز الدخول خاطئ",
    });
    return {
      ok: false,
      success: false,
      reason: "الرقم الوظيفي أو رمز الدخول غير صحيح",
    };
  }

  setManagerSession(null);
  setSession({
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    name: employee.name,
    loginAt: new Date().toISOString(),
    role: employee.role,
  });
  log({
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    actorName: employee.name,
    action: "login",
    result: "success",
  });

  return { ok: true, success: true };
}

export function logoutEmployee() {
  const token = savedToken("employee");
  setSession(null);
  backendLogout("employee");
  void revokeServerSession(token);
}

export function loginManager(
  password: string,
  username: string,
): LoginResult {
  const settings = getSettings();
  const inputUser = normalize(username);
  const inputPassword = password;

  if (!inputUser || !inputPassword) {
    return {
      ok: false,
      success: false,
      reason: "اسم المستخدم وكلمة المرور مطلوبان",
    };
  }

  const accounts = settings.adminAccounts || [];
  const matched = accounts.find(
    (account) =>
      account.active &&
      account.username.trim() === inputUser &&
      Boolean(account.passwordHash) &&
      verify(inputPassword, account.passwordHash),
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
    return {
      ok: false,
      success: false,
      reason: "اسم المستخدم وكلمة المرور غير صحيحة",
    };
  }

  const action =
    matched.role === "owner"
      ? "owner-login"
      : matched.role === "supervisor"
        ? "supervisor-login"
        : "manager-login";

  setSession(null);
  setManagerSession({
    loginAt: new Date().toISOString(),
    name: matched.name,
    role: matched.role,
    jobNumber: matched.username,
    accountId: matched.id,
  });
  log({
    employeeId: null,
    jobNumber: matched.username,
    actorName: matched.name,
    action,
    result: "success",
  });

  return { ok: true, success: true };
}

export function logoutManager() {
  const token = savedToken("admin");
  setManagerSession(null);
  backendLogout("admin");
  void revokeServerSession(token);
}

/** Local UI session only. The employee record and credentials remain authoritative in D1. */
let cachedSession: ReturnType<typeof getSession> | null | undefined;
let cachedSessionKey = "";

export function currentSession() {
  const session = getSession();
  if (!session) {
    cachedSession = null;
    cachedSessionKey = "";
    return null;
  }

  const key = `${session.employeeId}|${session.jobNumber}|${session.loginAt}|${session.role || ""}`;
  if (cachedSession !== undefined && cachedSessionKey === key) {
    return cachedSession;
  }

  cachedSession = session;
  cachedSessionKey = key;
  return session;
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
    const role =
      manager.role === "owner" ||
      manager.role === "manager" ||
      manager.role === "supervisor"
        ? manager.role
        : "manager";

    return {
      role,
      name: manager.name,
      loginAt: manager.loginAt,
      jobNumber: manager.jobNumber,
    };
  }

  const employee = currentSession();
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
