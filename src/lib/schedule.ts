import type { Employee } from "@/types";

export interface ScheduleStatus {
  isWorkDay: boolean;
  label: string;
  detail?: string;
}

/**
 * Calculate an employee's work/leave status for a local calendar date.
 * ADMIN employees use their configured workDays when present; legacy ADMIN
 * employees without workDays keep the default Sunday through Thursday schedule.
 * ROTATION employees use their configured on/off cycle (4/4, 3/3, 2/2, or custom).
 */
export function getEmployeeScheduleStatus(
  employee: Employee | null | undefined,
  target: Date = new Date()
): ScheduleStatus {
  if (!employee) {
    return { isWorkDay: false, label: "غير محدد" };
  }

  if ((employee.scheduleType ?? "ADMIN") === "ADMIN") {
    const day = target.getDay();
    const configuredDays = Array.isArray(employee.workDays)
      ? employee.workDays.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      : null;
    const workDays = configuredDays && configuredDays.length > 0
      ? [...new Set(configuredDays)].sort((a, b) => a - b)
      : [0, 1, 2, 3, 4];
    const isWorkDay = workDays.includes(day);
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const isDefault = workDays.length === 5 && workDays.every((value, index) => value === index);
    return {
      isWorkDay,
      label: isWorkDay ? "يوم عمل (إداري)" : "إجازة أسبوعية",
      detail: isDefault
        ? (isWorkDay ? "الدوام من الأحد إلى الخميس" : "الجمعة والسبت إجازة أسبوعية")
        : `أيام الدوام: ${workDays.map((value) => dayNames[value]).join("، ")}`,
    };
  }

  const startString = employee.rotationStartDate;
  if (!startString) {
    return {
      isWorkDay: false,
      label: "لم يتم تحديد بداية الوردية",
      detail: "يرجى تحديد تاريخ بداية أول وردية.",
    };
  }

  const start = parseYYYYMMDD(startString);
  if (!start) {
    return {
      isWorkDay: false,
      label: "تاريخ بداية الوردية غير صالح",
      detail: "يرجى تحديد تاريخ صحيح بصيغة YYYY-MM-DD.",
    };
  }

  const today = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      isWorkDay: false,
      label: "لم تبدأ الوردية بعد",
      detail: `تبدأ الوردية في ${startString}`,
    };
  }

  const daysOn = Math.max(1, Math.floor(employee.rotationDaysOn ?? 4));
  const daysOff = Math.max(0, Math.floor(employee.rotationDaysOff ?? 4));
  const cycleLength = daysOn + daysOff;

  if (cycleLength <= 0) {
    return { isWorkDay: false, label: "جدول غير صالح" };
  }

  const dayInCycle = diffDays % cycleLength;
  const isWorkDay = dayInCycle < daysOn;

  if (isWorkDay) {
    return {
      isWorkDay: true,
      label: "يوم عمل (تناوبي)",
      detail: `اليوم ${dayInCycle + 1} من ${daysOn} في الوردية`,
    };
  }

  return {
    isWorkDay: false,
    label: "يوم راحة (تناوبي)",
    detail: `اليوم ${dayInCycle - daysOn + 1} من ${daysOff} في الراحة`,
  };
}

function parseYYYYMMDD(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}
