import type { Employee } from "@/types";

export interface ScheduleStatus {
  isWorkDay: boolean;
  label: string;
  detail?: string;
  cycleDay?: number;
  cycleTotal?: number;
}

export interface WorkPeriod {
  isWorkDay: boolean;
  kind: "ADMIN" | "ROTATION" | "OFF" | "NOT_STARTED" | "INVALID";
  start: Date | null;
  end: Date | null;
  label: string;
  detail?: string;
}

export interface ScheduleCountdown {
  kind: "WORK_END" | "NEXT_WORK_START" | "NONE";
  target: Date | null;
  label: string;
}

const DAY_MS = 86_400_000;
const DEFAULT_ADMIN_DAYS = [0, 1, 2, 3, 4];
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function getEmployeeScheduleStatus(employee: Employee | null | undefined, target: Date = new Date()): ScheduleStatus {
  const period = getEmployeeWorkPeriod(employee, target);
  if (!employee) return { isWorkDay: false, label: "غير محدد" };
  if (period.kind === "NOT_STARTED") return { isWorkDay: false, label: "لم تبدأ المناوبة بعد", detail: period.detail };
  if (period.kind === "INVALID") return { isWorkDay: false, label: "جدول غير صالح", detail: period.detail };
  if (period.kind === "OFF") return { isWorkDay: false, label: "يوم راحة (تناوبي)", detail: period.detail };
  if (employee.scheduleType === "ROTATION") {
    const cycleDay = rotationCycleDay(employee, target);
    const on = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
    const off = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
    const total = on + off;
    return { isWorkDay: true, label: "يوم عمل (تناوبي)", detail: `اليوم ${cycleDay + 1} من ${total} في الدورة`, cycleDay: cycleDay + 1, cycleTotal: total };
  }
  return { isWorkDay: true, label: "يوم عمل (إداري)", detail: period.detail };
}

export function getEmployeeWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): WorkPeriod {
  if (!employee) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "غير محدد" };

  if ((employee.scheduleType ?? "ADMIN") === "ADMIN") {
    const workDays = normalizeWorkDays(employee.workDays);
    const day = target.getDay();
    if (!workDays.includes(day)) {
      return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "إجازة أسبوعية", detail: workDays.length ? `أيام الدوام: ${workDays.map((d) => DAY_NAMES[d]).join("، ")}` : "لم يتم تحديد أيام دوام إداري." };
    }
    const start = withTime(target, parseTime(employee.workStartTime, "09:00"));
    let end = withTime(target, parseTime(employee.workEndTime, "16:00"));
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + DAY_MS);
    return { isWorkDay: true, kind: "ADMIN", start, end, label: "دوام إداري", detail: `${formatTime(start)} → ${formatTime(end)}` };
  }

  const startDate = parseYYYYMMDD(employee.rotationStartDate);
  if (!startDate) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "تاريخ بداية المناوبة غير صالح", detail: "حدد تاريخ أول مناوبة." };
  const daysOn = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
  const daysOff = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
  const cycleLength = daysOn + daysOff;
  const firstStart = withTime(startDate, parseTime(employee.workStartTime, "09:00"));
  const diff = Math.floor((startOfDay(target).getTime() - startOfDay(firstStart).getTime()) / DAY_MS);
  if (diff < 0) return { isWorkDay: false, kind: "NOT_STARTED", start: null, end: null, label: "لم تبدأ المناوبة بعد", detail: `تبدأ أول مناوبة في ${employee.rotationStartDate} الساعة ${formatTime(firstStart)}` };
  const dayInCycle = diff % cycleLength;
  if (dayInCycle >= daysOn) {
    const offDay = dayInCycle - daysOn + 1;
    return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "راحة تناوبية", detail: `اليوم ${offDay} من ${daysOff} في الراحة` };
  }
  const periodStart = new Date(firstStart.getTime() + Math.floor(diff / cycleLength) * cycleLength * DAY_MS);
  const end = new Date(periodStart.getTime() + daysOn * DAY_MS);
  return { isWorkDay: true, kind: "ROTATION", start: periodStart, end, label: "مناوبة تناوبية", detail: `مناوبة ${dayInCycle + 1} من ${daysOn} · ${formatTime(periodStart)} → ${formatTime(end)}` };
}

export function getActiveWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): WorkPeriod {
  const current = getEmployeeWorkPeriod(employee, target);
  if (current.isWorkDay) return current;
  if (employee?.scheduleType === "ROTATION" && employee.rotationStartDate) {
    const previous = new Date(target.getTime() - DAY_MS);
    const previousPeriod = getEmployeeWorkPeriod(employee, previous);
    if (previousPeriod.isWorkDay && previousPeriod.start && previousPeriod.end && target >= previousPeriod.start && target <= previousPeriod.end) return previousPeriod;
  }
  return current;
}

export function getScheduleCountdown(employee: Employee | null | undefined, target: Date = new Date()): ScheduleCountdown {
  if (!employee) return { kind: "NONE", target: null, label: "" };
  const period = getEmployeeWorkPeriod(employee, target);
  if (period.kind === "NOT_STARTED") {
    const start = parseYYYYMMDD(employee.rotationStartDate);
    if (!start) return { kind: "NONE", target: null, label: "" };
    return { kind: "NEXT_WORK_START", target: withTime(start, parseTime(employee.workStartTime, "09:00")), label: "بداية أول مناوبة" };
  }
  if (period.isWorkDay && period.end) return { kind: "WORK_END", target: period.end, label: "نهاية المناوبة المتوقعة" };
  if (employee.scheduleType === "ROTATION" && period.kind === "OFF") {
    const startDate = parseYYYYMMDD(employee.rotationStartDate);
    if (!startDate) return { kind: "NONE", target: null, label: "" };
    const on = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
    const off = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
    const cycleLength = on + off;
    const firstStart = withTime(startDate, parseTime(employee.workStartTime, "09:00"));
    const diff = Math.max(0, Math.floor((startOfDay(target).getTime() - startOfDay(firstStart).getTime()) / DAY_MS));
    const cycleDay = diff % cycleLength;
    const daysUntilNext = cycleLength - cycleDay;
    const next = new Date(startOfDay(target).getTime() + daysUntilNext * DAY_MS);
    next.setHours(firstStart.getHours(), firstStart.getMinutes(), 0, 0);
    if (next.getTime() <= target.getTime()) next.setTime(next.getTime() + DAY_MS);
    return { kind: "NEXT_WORK_START", target: next, label: "بداية المناوبة القادمة" };
  }
  return { kind: "NONE", target: null, label: "" };
}

export function isWithinWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): boolean {
  const period = getActiveWorkPeriod(employee, target);
  return Boolean(period.isWorkDay && period.start && period.end && target >= period.start && target <= period.end);
}

function rotationCycleDay(employee: Employee, target: Date): number {
  const start = parseYYYYMMDD(employee.rotationStartDate);
  if (!start) return 0;
  const diff = Math.floor((startOfDay(target).getTime() - startOfDay(start).getTime()) / DAY_MS);
  const on = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
  const off = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
  return Math.max(0, diff) % (on + off);
}

function normalizeWorkDays(days: number[] | undefined): number[] {
  if (!Array.isArray(days)) return [...DEFAULT_ADMIN_DAYS];
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

function parseTime(value: string | undefined, fallback: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || fallback).trim());
  if (!match) return parseTime(fallback, "00:00");
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

function withTime(date: Date, time: { hours: number; minutes: number }): Date {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseYYYYMMDD(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
  return date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });
}
