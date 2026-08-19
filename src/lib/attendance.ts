import {
  addAttendance,
  findEmployeeByJobNumber,
  getAttendance,
  getEmployees,
  getSettings,
  saveEmployees,
} from "@/lib/storage";
import { getDeviceId, getClientIpPlaceholder } from "@/lib/device";
import { haversineMeters, type GeoPosition, isLikelyMockedPosition } from "@/lib/geo";
import type { AttendanceRecord } from "@/types";
import { log } from "@/lib/audit";
import { todayKey } from "@/lib/utils";
import { addNotification } from "@/lib/notifications";
import { getEmployeeScheduleStatus } from "@/lib/schedule";

export interface RecordArgs {
  jobNumber: string;
  type: "check-in" | "check-out";
  position: GeoPosition;
  qrCode: string;
}

export interface RecordResult {
  ok: boolean;
  reason?: string;
  record?: AttendanceRecord;
  distance?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  timeNote?: string;
}

export function todayRecords(employeeId: string): AttendanceRecord[] {
  const key = todayKey();
  return getAttendance().filter(
    (record) => record.employeeId === employeeId && todayKey(new Date(record.timestamp)) === key
  );
}

function parseTime(value: string | undefined): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function formatMinutesToText(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours} ساعة و ${minutes} دقيقة`;
  if (hours) return `${hours} ساعة`;
  return `${minutes} دقيقة`;
}

export async function recordAttendance(args: RecordArgs): Promise<RecordResult> {
  const settings = getSettings();
  const employee = findEmployeeByJobNumber(args.jobNumber);
  const deviceId = getDeviceId();

  if (!employee) {
    log({
      employeeId: null,
      jobNumber: args.jobNumber,
      actorName: "-",
      action: args.type,
      result: "rejected",
      reason: "الموظف غير موجود",
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return { ok: false, reason: "الموظف غير موجود" };
  }

  if (employee.status !== "active") {
    return { ok: false, reason: "الحساب موقوف" };
  }

  const schedule = getEmployeeScheduleStatus(employee);
  if (!schedule.isWorkDay) {
    return {
      ok: false,
      reason: `لا يوجد دوام للموظف اليوم: ${schedule.label}${schedule.detail ? ` · ${schedule.detail}` : ""}`,
    };
  }

  if (!employee.deviceId) {
    const employees = getEmployees();
    const index = employees.findIndex((item) => item.id === employee.id);
    if (index >= 0) {
      employees[index] = {
        ...employees[index],
        deviceId,
      };
      saveEmployees(employees);
    }
  } else if (employee.deviceId !== deviceId) {
    log({
      employeeId: employee.id,
      jobNumber: employee.jobNumber,
      actorName: employee.name,
      action: args.type,
      result: "rejected",
      reason: "الجهاز الحالي غير مرتبط بحساب الموظف",
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return { ok: false, reason: "الجهاز الحالي غير موثّق لهذا الحساب. يرجى استخدام الجهاز المسجل." };
  }

  const submittedQr = args.qrCode.trim();
  const expectedQr = (settings.qrCode || "").trim();
  if (!submittedQr || !expectedQr || submittedQr !== expectedQr) {
    return { ok: false, reason: "رمز QR غير صحيح أو لا يخص موقع العمل" };
  }

  const mockCheck = await isLikelyMockedPosition(args.position);
  if (mockCheck.mocked) {
    log({
      employeeId: employee.id,
      jobNumber: employee.jobNumber,
      actorName: employee.name,
      action: args.type,
      result: "rejected",
      reason: `موقع مزيّف محتمل: ${mockCheck.reasons.join("; ")}`,
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return { ok: false, reason: "تعذّر التحقق من موقعك. يرجى تعطيل أدوات تغيير الموقع." };
  }

  const assignedLocation = settings.locations?.find((location) => location.id === employee.locationId);
  const targetLat = assignedLocation?.lat ?? settings.workSiteLat;
  const targetLng = assignedLocation?.lng ?? settings.workSiteLng;
  const targetRadius = assignedLocation?.radiusMeters ?? settings.radiusMeters;
  const distance = haversineMeters(args.position, { lat: targetLat, lng: targetLng });

  if (distance > targetRadius) {
    log({
      employeeId: employee.id,
      jobNumber: employee.jobNumber,
      actorName: employee.name,
      action: args.type,
      result: "rejected",
      reason: `خارج نطاق مقر العمل (${distance} م / حد ${targetRadius} م)`,
      lat: args.position.lat,
      lng: args.position.lng,
      distanceMeters: distance,
    });
    return {
      ok: false,
      reason: `أنت خارج نطاق مقر العمل. المسافة الحالية: ${distance} م (الحد المسموح: ${targetRadius} م)`,
      distance,
    };
  }

  const todays = todayRecords(employee.id);
  const hasCheckIn = todays.some((record) => record.type === "check-in");
  const hasCheckOut = todays.some((record) => record.type === "check-out");

  if (args.type === "check-in" && hasCheckIn) {
    return { ok: false, reason: "تم تسجيل الحضور مسبقًا لهذا اليوم", distance };
  }

  if (args.type === "check-out") {
    if (!hasCheckIn) {
      return { ok: false, reason: "لا يمكن تسجيل الانصراف قبل تسجيل الحضور", distance };
    }
    if (hasCheckOut) {
      return { ok: false, reason: "تم تسجيل الانصراف مسبقًا لهذا اليوم", distance };
    }
  }

  const now = new Date();
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let timeNote = "";

  const start = parseTime(employee.workStartTime || settings.workStart);
  const end = parseTime(employee.workEndTime || settings.workEnd);
  const grace = Math.max(0, employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 0);

  if (args.type === "check-in" && start) {
    const scheduledStart = new Date(now);
    scheduledStart.setHours(start.hours, start.minutes, 0, 0);
    const difference = Math.round((now.getTime() - scheduledStart.getTime()) / 60000);
    if (difference > grace) {
      lateMinutes = difference;
      timeNote = `تم تسجيل الحضور متأخراً بمقدار ${formatMinutesToText(lateMinutes)}`;
    } else {
      timeNote = "تم تسجيل الحضور ضمن الوقت المسموح";
    }
  }

  if (args.type === "check-out" && end) {
    const scheduledEnd = new Date(now);
    scheduledEnd.setHours(end.hours, end.minutes, 0, 0);
    const difference = Math.round((scheduledEnd.getTime() - now.getTime()) / 60000);
    if (difference > 0) {
      earlyMinutes = difference;
      timeNote = `تم تسجيل الانصراف مبكراً بمقدار ${formatMinutesToText(earlyMinutes)}`;
    } else {
      timeNote = "تم تسجيل الانصراف في الوقت المحدد أو بعده";
    }
  }

  const record: AttendanceRecord = {
    id: crypto.randomUUID(),
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    employeeName: employee.name,
    type: args.type,
    timestamp: now.toISOString(),
    lat: args.position.lat,
    lng: args.position.lng,
    distanceMeters: distance,
    deviceId,
    ip: getClientIpPlaceholder(),
    qrCode: submittedQr,
    locationId: assignedLocation?.id || "main",
  };

  addAttendance(record);

  log({
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    actorName: employee.name,
    action: args.type,
    result: "success",
    reason: timeNote,
    lat: args.position.lat,
    lng: args.position.lng,
    distanceMeters: distance,
  });

  const actionTitle = args.type === "check-in" ? "تسجيل حضور" : "تسجيل انصراف";
  addNotification({
    userId: employee.jobNumber,
    title: `تم ${actionTitle} بنجاح`,
    body: timeNote,
    type: "success",
  });
  addNotification({
    userId: "admin",
    title: `سجل جديد: ${actionTitle}`,
    body: `قام الموظف (${employee.name}) بـ${actionTitle}. ${timeNote}`,
    type: "info",
  });

  return {
    ok: true,
    record,
    distance,
    lateMinutes,
    earlyMinutes,
    timeNote,
  };
}
