import type { Employee } from "@/types";
import { normalizeDigits } from "@/lib/utils";

export interface ScheduleStatus { isWorkDay: boolean; label: string; detail?: string; cycleDay?: number; cycleTotal?: number; }
export interface WorkPeriod { isWorkDay: boolean; kind: "ADMIN" | "ROTATION" | "OFF" | "NOT_STARTED" | "INVALID"; start: Date | null; end: Date | null; label: string; detail?: string; }
export interface ScheduleCountdown { kind: "WORK_END" | "NEXT_WORK_START" | "NONE"; target: Date | null; label: string; }

const DAY_MS = 86_400_000;
const DEFAULT_ADMIN_DAYS = [0, 1, 2, 3, 4];
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function getEmployeeScheduleStatus(employee: Employee | null | undefined, target: Date = new Date()): ScheduleStatus {
  const period = getEmployeeWorkPeriod(employee, target);
  if (!employee) return { isWorkDay: false, label: "غير محدد" };
  if (period.kind === "NOT_STARTED") return { isWorkDay: false, label: "لم تبدأ المناوبة بعد", detail: period.detail };
  if (period.kind === "INVALID") return { isWorkDay: false, label: "جدول غير صالح", detail: period.detail };
  if (employee.scheduleType === "ROTATION") {
    const info = getRotationInfo(employee, target);
    if (!info) return { isWorkDay: false, label: "جدول غير صالح" };
    if (info.phase === "OFF") {
      const restDay = info.cycleDay - info.daysOn + 1;
      return { isWorkDay: false, label: "فترة راحة", detail: `اليوم ${normalizeDigits(String(restDay))} من ${normalizeDigits(String(info.daysOff))} في الراحة`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff };
    }
    return { isWorkDay: true, label: "في المناوبة", detail: `اليوم ${normalizeDigits(String(info.workDay + 1))} من ${normalizeDigits(String(info.daysOn))} في المناوبة`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff };
  }
  if (period.kind === "OFF") return { isWorkDay: false, label: "إجازة أسبوعية", detail: period.detail };
  return { isWorkDay: true, label: "يوم عمل (إداري)", detail: period.detail };
}

export function getEmployeeWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): WorkPeriod {
  if (!employee) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "غير محدد" };
  if ((employee.scheduleType ?? "ADMIN") === "ADMIN") {
    const workDays = normalizeWorkDays(employee.workDays);
    const day = target.getDay();
    if (!workDays.includes(day)) return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "إجازة أسبوعية", detail: workDays.length ? `أيام الدوام: ${workDays.map((d) => DAY_NAMES[d]).join("، ")}` : "لم يتم تحديد أيام دوام إداري." };
    const start = withTime(target, parseTime(employee.workStartTime, "09:00"));
    let end = withTime(target, parseTime(employee.workEndTime, "16:00"));
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + DAY_MS);
    return { isWorkDay: true, kind: "ADMIN", start, end, label: "دوام إداري", detail: `${formatTime(start)} → ${formatTime(end)}` };
  }

  const info = getRotationInfo(employee, target);
  if (!info) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "تاريخ بداية المناوبة غير صالح", detail: "حدد تاريخ أول مناوبة." };
  if (info.phase === "NOT_STARTED") return { isWorkDay: false, kind: "NOT_STARTED", start: null, end: null, label: "لم تبدأ المناوبة بعد", detail: `تبدأ أول مناوبة في ${employee.rotationStartDate} الساعة ${formatTime(info.firstStart)}` };
  if (info.phase === "OFF") return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "راحة تناوبية", detail: `اليوم ${normalizeDigits(String(info.cycleDay - info.daysOn + 1))} من ${normalizeDigits(String(info.daysOff))} في الراحة` };

  // Rotation days are elapsed 24-hour periods, not inclusive calendar dates.
  // 4/4 starting Sunday at 09:00 runs Sunday 09:00 -> Thursday 09:00.
  const periodStart = info.periodStart;
  const end = new Date(periodStart.getTime() + info.daysOn * DAY_MS);
  return { isWorkDay: true, kind: "ROTATION", start: periodStart, end, label: "مناوبة تناوبية", detail: `من ${formatDateTime(periodStart)} → ${formatDateTime(end)}` };
}

export function getActiveWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): WorkPeriod {
  const current = getEmployeeWorkPeriod(employee, target);
  if (current.isWorkDay) return current;
  if (employee?.scheduleType === "ROTATION" && employee.rotationStartDate) {
    const previous = new Date(target.getTime() - DAY_MS);
    const previousPeriod = getEmployeeWorkPeriod(employee, previous);
    if (previousPeriod.isWorkDay && previousPeriod.start && previousPeriod.end && target >= previousPeriod.start && target < previousPeriod.end) return previousPeriod;
  }
  return current;
}

export function getScheduleCountdown(employee: Employee | null | undefined, target: Date = new Date()): ScheduleCountdown {
  if (!employee) return { kind: "NONE", target: null, label: "" };
  const period = getEmployeeWorkPeriod(employee, target);
  if (period.kind === "NOT_STARTED") {
    const info = getRotationInfo(employee, target);
    if (!info) return { kind: "NONE", target: null, label: "" };
    return { kind: "NEXT_WORK_START", target: info.firstStart, label: "بداية أول مناوبة" };
  }
  if (period.isWorkDay && period.end && period.end.getTime() > target.getTime()) return { kind: "WORK_END", target: period.end, label: "تنتهي المناوبة خلال" };
  if (employee.scheduleType === "ROTATION" && period.kind === "OFF") {
    const info = getRotationInfo(employee, target);
    if (!info) return { kind: "NONE", target: null, label: "" };
    const next = new Date(info.periodStart.getTime() + (info.daysOn + info.daysOff) * DAY_MS);
    return { kind: "NEXT_WORK_START", target: next, label: "تبدأ المناوبة القادمة خلال" };
  }
  return { kind: "NONE", target: null, label: "" };
}

export function isWithinWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): boolean {
  const period = getActiveWorkPeriod(employee, target);
  return Boolean(period.isWorkDay && period.start && period.end && target >= period.start && target < period.end);
}

function getRotationInfo(employee: Employee, target: Date): { firstStart: Date; periodStart: Date; daysOn: number; daysOff: number; cycleDay: number; workDay: number; phase: "WORK" | "OFF" | "NOT_STARTED" } | null {
  const startDate = parseYYYYMMDD(employee.rotationStartDate);
  if (!startDate) return null;
  const daysOn = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
  const daysOff = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
  const cycleLength = daysOn + daysOff;
  const firstStart = withTime(startDate, parseTime(employee.rotationStartTime || employee.workStartTime, "09:00"));
  const elapsed = target.getTime() - firstStart.getTime();
  if (elapsed < 0) return { firstStart, periodStart: firstStart, daysOn, daysOff, cycleDay: 0, workDay: 0, phase: "NOT_STARTED" };
  const cycleMs = cycleLength * DAY_MS;
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const cycleElapsed = elapsed - cycleIndex * cycleMs;
  const cycleDay = Math.floor(cycleElapsed / DAY_MS);
  const periodStart = new Date(firstStart.getTime() + cycleIndex * cycleMs);
  if (cycleDay >= daysOn) return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: 0, phase: "OFF" };
  return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: cycleDay, phase: "WORK" };
}

function normalizeWorkDays(days: number[] | undefined): number[] { if (!Array.isArray(days)) return [...DEFAULT_ADMIN_DAYS]; return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b); }
function parseTime(value: string | undefined, fallback: string): { hours: number; minutes: number } { const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || fallback).trim()); if (!match) return parseTime(fallback, "00:00"); return { hours: Math.min(23, Math.max(0, Number(match[1]))), minutes: Math.min(59, Math.max(0, Number(match[2]))) }; }
function withTime(date: Date, time: { hours: number; minutes: number }): Date { const result = new Date(date); result.setHours(time.hours, time.minutes, 0, 0); return result; }
function parseYYYYMMDD(value: string | null | undefined): Date | null { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim()); if (!match) return null; const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])); if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null; return date; }
function formatTime(date: Date): string { return normalizeDigits(date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })); }
function formatDateTime(date: Date): string { return `${normalizeDigits(date.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }))} ${formatTime(date)}`; }
