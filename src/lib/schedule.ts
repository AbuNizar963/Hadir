import type { Employee } from "@/types";

export interface ScheduleStatus {
  isWorkDay: boolean;
  label: string;
  detail?: string;
}

/**
 * حساب حالة الدوام لموظف في تاريخ معين.
 * - ADMIN: الأحد إلى الخميس أيام عمل، الجمعة والسبت إجازة.
 * - ROTATION: (تاريخ اليوم − rotationStartDate) % 8
 *   أيام 0..3 = عمل (On)، أيام 4..7 = راحة (Off).
 */
export function getEmployeeScheduleStatus(
  emp: Employee | null | undefined,
  target: Date = new Date()
): ScheduleStatus {
  if (!emp) {
    return { isWorkDay: false, label: "غير محدد" };
  }

  const type = emp.scheduleType ?? "ADMIN";

  if (type === "ADMIN") {
    // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const day = target.getDay();
    const isWork = day !== 5 && day !== 6;
    return {
      isWorkDay: isWork,
      label: isWork ? "يوم عمل (إداري)" : "إجازة أسبوعية",
      detail: isWork ? "الدوام من الأحد إلى الخميس" : "الجمعة والسبت إجازة رسمية",
    };
  }

  // ROTATION
  const startStr = emp.rotationStartDate;
  if (!startStr) {
    return {
      isWorkDay: false,
      label: "لم يتم تحديد بداية الوردية",
      detail: "يرجى مراجعة المدير لضبط تاريخ بداية أول وردية.",
    };
  }

  const start = parseYYYYMMDD(startStr);
  const today = new Date(target);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return {
      isWorkDay: false,
      label: "لم تبدأ الوردية بعد",
      detail: `تبدأ الوردية في ${startStr}`,
    };
  }

  const cycleLength = 8;
  const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  const isWork = dayInCycle >= 0 && dayInCycle <= 3;

  if (isWork) {
    return {
      isWorkDay: true,
      label: "يوم عمل (تناوبي)",
      detail: `يوم ${dayInCycle + 1} من 4 في وردية العمل الحالية`,
    };
  }

  return {
    isWorkDay: false,
    label: "يوم راحة (Off)",
    detail: `يوم ${dayInCycle - 3} من 4 في فترة الراحة الحالية`,
  };
}

function parseYYYYMMDD(str: string): Date {
  const parts = str.split("-").map(Number);
  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}
