import type { Employee } from "@/types";
import { normalizeDigits } from "@/lib/utils";

export interface ScheduleStatus { isWorkDay: boolean; label: string; detail?: string; cycleDay?: number; cycleTotal?: number; }
export interface WorkPeriod { isWorkDay: boolean; kind: "ADMIN" | "ROTATION" | "OFF" | "NOT_STARTED" | "INVALID"; start: Date | null; end: Date | null; label: string; detail?: string; }
export interface ScheduleCountdown { kind: "WORK_END" | "NEXT_WORK_START" | "NONE"; target: Date | null; label: string; }

const TZ = "Asia/Damascus";
const DAY_MS = 86_400_000;
const DEFAULT_ADMIN_DAYS = [0, 1, 2, 3, 4];
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function tzParts(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")), minute: Number(get("minute")) };
}
function dayKey(date: Date) { const p = tzParts(date); return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`; }
function dayNumber(day: string) { return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS; }
function addLocalDaysToKey(day: string, days: number) { return new Date((dayNumber(day) + days) * DAY_MS).toISOString().slice(0, 10); }
function damascusOffsetMinutes(day: string) {
  const noon = new Date(`${day}T12:00:00Z`); const p = tzParts(noon);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - noon.getTime()) / 60000);
}
function localDateTimeUtc(day: string, time: string) {
  const t = parseTime(time, "09:00");
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), t.hours, t.minutes) - damascusOffsetMinutes(day) * 60000);
}

export function getEmployeeScheduleStatus(employee: Employee | null | undefined, target: Date = new Date()): ScheduleStatus {
  const period = getEmployeeWorkPeriod(employee, target);
  if (!employee) return { isWorkDay: false, label: "غير محدد" };
  if (period.kind === "NOT_STARTED") return { isWorkDay: false, label: "لم تبدأ المناوبة بعد", detail: period.detail };
  if (period.kind === "INVALID") return { isWorkDay: false, label: "جدول غير صالح", detail: period.detail };
  if (employee.scheduleType === "ROTATION") {
    const info = getRotationInfo(employee, target);
    if (!info) return { isWorkDay: false, label: "جدول غير صالح" };
    if (info.phase === "OFF") { const restDay = info.cycleDay - info.daysOn + 1; return { isWorkDay: false, label: "فترة راحة", detail: `اليوم ${normalizeDigits(String(restDay))} من ${normalizeDigits(String(info.daysOff))} في الراحة`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff }; }
    return { isWorkDay: true, label: "في المناوبة", detail: `اليوم ${normalizeDigits(String(info.workDay + 1))} من ${normalizeDigits(String(info.daysOn))} في المناوبة`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff };
  }
  if (period.kind === "OFF") return { isWorkDay: false, label: "إجازة أسبوعية", detail: period.detail };
  if (period.end && target.getTime() >= period.end.getTime()) { const next = getNextAdminWorkStart(employee, target); return { isWorkDay: false, label: "فترة راحة", detail: next ? `انتهى دوام اليوم · العمل القادم ${formatDateTime(next)}` : "انتهى دوام اليوم" }; }
  return { isWorkDay: true, label: "في المناوبة", detail: "يوم عمل (إداري)" };
}

export function getEmployeeWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): WorkPeriod {
  if (!employee) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "غير محدد" };
  const scheduleType = String(employee.scheduleType ?? "ADMIN").toUpperCase();
  if (scheduleType === "ADMIN") {
    const day = dayKey(target);
    const workDays = normalizeWorkDays(employee.workDays);
    const weekday = new Date(dayNumber(day) * DAY_MS).getUTCDay();
    if (!workDays.includes(weekday)) return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "إجازة أسبوعية", detail: workDays.length ? `أيام الدوام: ${workDays.map((d) => DAY_NAMES[d]).join("، ")}` : "لم يتم تحديد أيام دوام إداري." };
    const start = localDateTimeUtc(day, employee.workStartTime || "09:00");
    const rawEnd = localDateTimeUtc(day, employee.workEndTime || "16:00");
    const end = rawEnd.getTime() <= start.getTime() ? new Date(rawEnd.getTime() + DAY_MS) : rawEnd;
    return { isWorkDay: true, kind: "ADMIN", start, end, label: "دوام إداري", detail: `${formatTime(start)} → ${formatTime(end)}` };
  }
  const info = getRotationInfo(employee, target);
  if (!info) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "تاريخ بداية المناوبة غير صالح", detail: "حدد تاريخ أول مناوبة." };
  if (info.phase === "NOT_STARTED") return { isWorkDay: false, kind: "NOT_STARTED", start: null, end: null, label: "لم تبدأ المناوبة بعد", detail: `تبدأ أول مناوبة في ${employee.rotationStartDate} الساعة ${formatTime(info.firstStart)}` };
  if (info.phase === "OFF") return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "راحة تناوبية", detail: `اليوم ${normalizeDigits(String(info.cycleDay - info.daysOn + 1))} من ${normalizeDigits(String(info.daysOff))} في الراحة` };
  const periodStart = info.periodStart;
  const end = localDateTimeUtc(addLocalDaysToKey(dayKey(periodStart), info.daysOn), employee.workEndTime || employee.workStartTime || "09:00");
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
  if (period.kind === "NOT_STARTED") { const info = getRotationInfo(employee, target); if (!info) return { kind: "NONE", target: null, label: "" }; return { kind: "NEXT_WORK_START", target: info.firstStart, label: "بداية أول مناوبة" }; }
  if (period.isWorkDay && period.end && period.end.getTime() > target.getTime()) return { kind: "WORK_END", target: period.end, label: "تنتهي المناوبة خلال" };
  if (employee.scheduleType === "ROTATION" && period.kind === "OFF") { const info = getRotationInfo(employee, target); if (!info) return { kind: "NONE", target: null, label: "" }; const next = new Date(info.periodStart.getTime() + (info.daysOn + info.daysOff) * DAY_MS); return { kind: "NEXT_WORK_START", target: next, label: "تبدأ المناوبة القادمة خلال" }; }
  if ((employee.scheduleType ?? "ADMIN") === "ADMIN") { const next = getNextAdminWorkStart(employee, target); return next ? { kind: "NEXT_WORK_START", target: next, label: "تبدأ المناوبة القادمة خلال" } : { kind: "NONE", target: null, label: "" }; }
  return { kind: "NONE", target: null, label: "" };
}

export function isWithinWorkPeriod(employee: Employee | null | undefined, target: Date = new Date()): boolean { const period = getActiveWorkPeriod(employee, target); return Boolean(period.isWorkDay && period.start && period.end && target >= period.start && target < period.end); }

function getNextAdminWorkStart(employee: Employee, target: Date): Date | null {
  const days = normalizeWorkDays(employee.workDays); if (!days.length) return null;
  const startTime = employee.workStartTime || "09:00"; const today = dayKey(target);
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDay = addLocalDaysToKey(today, offset); const candidate = localDateTimeUtc(candidateDay, startTime);
    if (!days.includes(new Date(dayNumber(candidateDay) * DAY_MS).getUTCDay())) continue;
    if (candidate.getTime() > target.getTime()) return candidate;
  }
  return null;
}

function getRotationInfo(employee: Employee, target: Date): { firstStart: Date; periodStart: Date; daysOn: number; daysOff: number; cycleDay: number; workDay: number; phase: "WORK" | "OFF" | "NOT_STARTED" } | null {
  const startDay = String(employee.rotationStartDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return null;
  const daysOn = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4)); const daysOff = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4)); const cycleLength = daysOn + daysOff;
  if (cycleLength <= 0) return null;
  const firstStart = localDateTimeUtc(startDay, employee.workStartTime || employee.rotationStartTime || "09:00");
  if (target.getTime() < firstStart.getTime()) return { firstStart, periodStart: firstStart, daysOn, daysOff, cycleDay: 0, workDay: 0, phase: "NOT_STARTED" };
  const targetDay = dayKey(target);
  const diff = Math.floor(dayNumber(targetDay) - dayNumber(startDay));
  if (diff < 0) return { firstStart, periodStart: firstStart, daysOn, daysOff, cycleDay: 0, workDay: 0, phase: "NOT_STARTED" };
  const cycleIndex = Math.floor(diff / cycleLength);
  const cycleDay = diff - cycleIndex * cycleLength;
  const periodStartDay = addLocalDaysToKey(startDay, cycleIndex * cycleLength);
  const periodStart = localDateTimeUtc(periodStartDay, employee.workStartTime || employee.rotationStartTime || "09:00");
  if (cycleDay < daysOn) return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: cycleDay, phase: "WORK" };
  if (cycleDay === daysOn) {
    const periodEnd = localDateTimeUtc(addLocalDaysToKey(periodStartDay, daysOn), employee.workEndTime || employee.workStartTime || "09:00");
    if (target.getTime() < periodEnd.getTime()) return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: daysOn - 1, phase: "WORK" };
  }
  return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: 0, phase: "OFF" };
}

function normalizeWorkDays(days: number[] | undefined): number[] { if (!Array.isArray(days)) return [...DEFAULT_ADMIN_DAYS]; return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b); }
function parseTime(value: string | undefined, fallback: string): { hours: number; minutes: number } { const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || fallback).trim()); if (!match) return parseTime(fallback, "00:00"); return { hours: Math.min(23, Math.max(0, Number(match[1]))), minutes: Math.min(59, Math.max(0, Number(match[2]))) }; }
function formatTime(date: Date): string { return normalizeDigits(date.toLocaleTimeString("ar-EG", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })); }
function formatDateTime(date: Date): string { return `${normalizeDigits(date.toLocaleDateString("ar-EG", { timeZone: TZ, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }))} ${formatTime(date)}`; }