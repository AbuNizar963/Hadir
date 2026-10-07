import type { Employee } from "@/types";
import { getSystemTimeZone } from "@/lib/systemTimezone";
import { normalizeDigits } from "@/lib/utils";

export interface ScheduleStatus { isWorkDay: boolean; label: string; detail?: string; cycleDay?: number; cycleTotal?: number; }
export interface WorkPeriod { isWorkDay: boolean; kind: "ADMIN" | "ROTATION" | "OFF" | "NOT_STARTED" | "INVALID"; start: Date | null; end: Date | null; label: string; detail?: string; }
export interface ScheduleCountdown { kind: "WORK_END" | "NEXT_WORK_START" | "NONE"; target: Date | null; label: string; }

const DAY_MS = 86_400_000;
const DEFAULT_ADMIN_DAYS = [0, 1, 2, 3, 4];
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };
function tzParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
}
function wallClockAsUtc(date: Date, timeZone: string): number {
  const parts = tzParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}
function dayKey(date: Date, timeZone: string): string {
  const parts = tzParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
function dayNumber(day: string) { return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS; }
function addLocalDaysToKey(day: string, days: number) { return new Date((dayNumber(day) + days) * DAY_MS).toISOString().slice(0, 10); }
function localDateTimeUtc(day: string, time: string | undefined, timeZone: string): Date {
  const parsed = parseTime(time, "09:00");
  const targetWallTime = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), parsed.hours, parsed.minutes);
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = new Date(targetWallTime + delta * 60 * 60 * 1000);
    offsets.add(Math.round((wallClockAsUtc(probe, timeZone) - Math.floor(probe.getTime() / 60_000) * 60_000) / 60_000));
  }
  const candidates = [...offsets].map((offset) => new Date(targetWallTime - offset * 60_000));
  const exact = candidates.filter((candidate) => wallClockAsUtc(candidate, timeZone) === targetWallTime);
  if (exact.length) return exact.sort((a, b) => a.getTime() - b.getTime())[0];
  // A configured wall-clock time can be skipped by a DST transition. Move it
  // forward by the transition gap, matching the usual calendar-time behavior.
  const after = candidates
    .map((candidate) => ({ candidate, wall: wallClockAsUtc(candidate, timeZone) }))
    .filter((item) => item.wall > targetWallTime)
    .sort((a, b) => (a.wall - b.wall) || (a.candidate.getTime() - b.candidate.getTime()));
  if (after.length) return after[0].candidate;
  return candidates[0] || new Date(targetWallTime);
}

export function getEmployeeScheduleStatus(employee: Employee | null | undefined, target: Date = new Date(), timeZone = getSystemTimeZone()): ScheduleStatus {
  const period = getEmployeeWorkPeriod(employee, target, timeZone);
  if (!employee) return { isWorkDay: false, label: "غير محدد" };
  if (period.kind === "NOT_STARTED") return { isWorkDay: false, label: "لم يبدأ العمل بعد", detail: period.detail };
  if (period.kind === "INVALID") return { isWorkDay: false, label: "جدول غير صالح", detail: period.detail };
  if (employee.scheduleType === "ROTATION") {
    const info = getRotationInfo(employee, target, timeZone);
    if (!info) return { isWorkDay: false, label: "جدول غير صالح" };
    if (info.phase === "OFF") { const restDay = info.cycleDay - info.daysOn + 1; return { isWorkDay: false, label: "فترة راحة", detail: `اليوم ${normalizeDigits(String(restDay))} من ${normalizeDigits(String(info.daysOff))} في الراحة`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff }; }
    return { isWorkDay: true, label: "في العمل", detail: `اليوم ${normalizeDigits(String(info.workDay + 1))} من ${normalizeDigits(String(info.daysOn))} من أيام العمل`, cycleDay: info.cycleDay + 1, cycleTotal: info.daysOn + info.daysOff };
  }
  if (period.kind === "OFF") return { isWorkDay: false, label: "إجازة أسبوعية", detail: period.detail };
  if (period.end && target.getTime() >= period.end.getTime()) { const next = getNextAdminWorkStart(employee, target, timeZone); return { isWorkDay: false, label: "فترة راحة", detail: next ? `انتهى دوام اليوم · العمل القادم ${formatDateTime(next, timeZone)}` : "انتهى دوام اليوم" }; }
  return { isWorkDay: true, label: "في العمل", detail: "يوم عمل (إداري)" };
}

export function getEmployeeWorkPeriod(employee: Employee | null | undefined, target: Date = new Date(), timeZone = getSystemTimeZone()): WorkPeriod {
  if (!employee) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "غير محدد" };
  const scheduleType = String(employee.scheduleType ?? "ADMIN").toUpperCase();
  if (scheduleType === "ADMIN") {
    const day = dayKey(target, timeZone);
    const workDays = normalizeWorkDays(employee.workDays);
    const weekday = new Date(dayNumber(day) * DAY_MS).getUTCDay();
    if (!workDays.includes(weekday)) return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "إجازة أسبوعية", detail: workDays.length ? `أيام الدوام: ${workDays.map((d) => DAY_NAMES[d]).join("، ")}` : "لم يتم تحديد أيام دوام إداري." };
    const start = localDateTimeUtc(day, employee.workStartTime || "09:00", timeZone);
    const endTime = employee.workEndTime || "16:00";
    const rawEnd = localDateTimeUtc(day, endTime, timeZone);
    const end = rawEnd.getTime() <= start.getTime() ? localDateTimeUtc(addLocalDaysToKey(day, 1), endTime, timeZone) : rawEnd;
    if (target.getTime() < start.getTime()) return { isWorkDay: false, kind: "NOT_STARTED", start, end, label: "لم يبدأ العمل بعد", detail: `يبدأ العمل الساعة ${formatTime(start, timeZone)}` };
    return { isWorkDay: true, kind: "ADMIN", start, end, label: "دوام إداري", detail: `${formatTime(start, timeZone)} → ${formatTime(end, timeZone)}` };
  }
  const info = getRotationInfo(employee, target, timeZone);
  if (!info) return { isWorkDay: false, kind: "INVALID", start: null, end: null, label: "تاريخ بداية العمل غير صالح", detail: "حدد تاريخ أول يوم عمل." };
  if (info.phase === "NOT_STARTED") return { isWorkDay: false, kind: "NOT_STARTED", start: null, end: null, label: "لم يبدأ العمل بعد", detail: `يبدأ أول يوم عمل في ${employee.rotationStartDate} الساعة ${formatTime(info.firstStart, timeZone)}` };
  if (info.phase === "OFF") return { isWorkDay: false, kind: "OFF", start: null, end: null, label: "راحة تناوبية", detail: `اليوم ${normalizeDigits(String(info.cycleDay - info.daysOn + 1))} من ${normalizeDigits(String(info.daysOff))} في الراحة` };
  const periodStart = info.periodStart;
  const end = localDateTimeUtc(addLocalDaysToKey(dayKey(periodStart, timeZone), info.daysOn), employee.workStartTime || employee.rotationStartTime || "09:00", timeZone);
  if (target.getTime() < periodStart.getTime()) return { isWorkDay: false, kind: "NOT_STARTED", start: periodStart, end, label: "لم يبدأ العمل بعد", detail: `يبدأ العمل الساعة ${formatTime(periodStart, timeZone)}` };
  return { isWorkDay: true, kind: "ROTATION", start: periodStart, end, label: "عمل تناوبي", detail: `من ${formatDateTime(periodStart, timeZone)} → ${formatDateTime(end, timeZone)}` };
}

export function getActiveWorkPeriod(employee: Employee | null | undefined, target: Date = new Date(), timeZone = getSystemTimeZone()): WorkPeriod {
  const current = getEmployeeWorkPeriod(employee, target, timeZone);
  if (current.isWorkDay) return current;
  if (employee?.scheduleType === "ROTATION" && employee.rotationStartDate) {
    const previous = new Date(target.getTime() - DAY_MS);
    const previousPeriod = getEmployeeWorkPeriod(employee, previous, timeZone);
    if (previousPeriod.isWorkDay && previousPeriod.start && previousPeriod.end && target >= previousPeriod.start && target < previousPeriod.end) return previousPeriod;
  }
  return current;
}

export function getScheduleCountdown(employee: Employee | null | undefined, target: Date = new Date(), timeZone = getSystemTimeZone()): ScheduleCountdown {
  if (!employee) return { kind: "NONE", target: null, label: "" };
  const period = getEmployeeWorkPeriod(employee, target, timeZone);
  if (period.kind === "NOT_STARTED") return { kind: "NEXT_WORK_START", target: period.start, label: "يبدأ العمل خلال" };
  if (period.isWorkDay && period.end && period.end.getTime() > target.getTime()) return { kind: "WORK_END", target: period.end, label: "ينتهي العمل خلال" };
  if (employee.scheduleType === "ROTATION" && period.kind === "OFF") { const info = getRotationInfo(employee, target, timeZone); if (!info) return { kind: "NONE", target: null, label: "" }; const next = localDateTimeUtc(addLocalDaysToKey(dayKey(info.periodStart, timeZone), info.daysOn + info.daysOff), employee.workStartTime || employee.rotationStartTime || "09:00", timeZone); return { kind: "NEXT_WORK_START", target: next, label: "يبدأ العمل القادم خلال" }; }
  if ((employee.scheduleType ?? "ADMIN") === "ADMIN") { const next = getNextAdminWorkStart(employee, target, timeZone); return next ? { kind: "NEXT_WORK_START", target: next, label: "يبدأ العمل القادم خلال" } : { kind: "NONE", target: null, label: "" }; }
  return { kind: "NONE", target: null, label: "" };
}

export function isWithinWorkPeriod(employee: Employee | null | undefined, target: Date = new Date(), timeZone = getSystemTimeZone()): boolean { const period = getActiveWorkPeriod(employee, target, timeZone); return Boolean(period.isWorkDay && period.start && period.end && target >= period.start && target < period.end); }

function getNextAdminWorkStart(employee: Employee, target: Date, timeZone: string): Date | null {
  const days = normalizeWorkDays(employee.workDays); if (!days.length) return null;
  const startTime = employee.workStartTime || "09:00"; const today = dayKey(target, timeZone);
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDay = addLocalDaysToKey(today, offset); const candidate = localDateTimeUtc(candidateDay, startTime, timeZone);
    if (!days.includes(new Date(dayNumber(candidateDay) * DAY_MS).getUTCDay())) continue;
    if (candidate.getTime() > target.getTime()) return candidate;
  }
  return null;
}

function getRotationInfo(employee: Employee, target: Date, timeZone: string): { firstStart: Date; periodStart: Date; daysOn: number; daysOff: number; cycleDay: number; workDay: number; phase: "WORK" | "OFF" | "NOT_STARTED" } | null {
  const startDay = String(employee.rotationStartDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return null;
  const daysOn = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4)); const daysOff = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4)); const cycleLength = daysOn + daysOff;
  if (cycleLength <= 0) return null;
  const firstStart = localDateTimeUtc(startDay, employee.workStartTime || employee.rotationStartTime || "09:00", timeZone);
  if (target.getTime() < firstStart.getTime()) return { firstStart, periodStart: firstStart, daysOn, daysOff, cycleDay: 0, workDay: 0, phase: "NOT_STARTED" };
  const targetDay = dayKey(target, timeZone);
  const diff = Math.floor(dayNumber(targetDay) - dayNumber(startDay));
  if (diff < 0) return { firstStart, periodStart: firstStart, daysOn, daysOff, cycleDay: 0, workDay: 0, phase: "NOT_STARTED" };
  const cycleIndex = Math.floor(diff / cycleLength);
  const cycleDay = diff - cycleIndex * cycleLength;
  const periodStartDay = addLocalDaysToKey(startDay, cycleIndex * cycleLength);
  const periodStart = localDateTimeUtc(periodStartDay, employee.workStartTime || employee.rotationStartTime || "09:00", timeZone);
  if (cycleDay < daysOn) return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: cycleDay, phase: "WORK" };
  return { firstStart, periodStart, daysOn, daysOff, cycleDay, workDay: 0, phase: "OFF" };
}

function normalizeWorkDays(days: number[] | undefined): number[] { if (!Array.isArray(days)) return [...DEFAULT_ADMIN_DAYS]; return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b); }
function parseTime(value: string | undefined, fallback: string): { hours: number; minutes: number } { const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || fallback).trim()); if (!match) return parseTime(fallback, "00:00"); return { hours: Math.min(23, Math.max(0, Number(match[1]))), minutes: Math.min(59, Math.max(0, Number(match[2]))) }; }
function formatTime(date: Date, timeZone: string): string { return normalizeDigits(date.toLocaleTimeString("ar-EG", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false })); }
function formatDateTime(date: Date, timeZone: string): string { return `${normalizeDigits(date.toLocaleDateString("ar-EG", { timeZone, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }))} ${formatTime(date, timeZone)}`; }
