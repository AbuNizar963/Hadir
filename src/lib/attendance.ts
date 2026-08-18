import {
  addAttendance,
  findEmployeeByJobNumber,
  getAttendance,
  getSettings,
} from "@/lib/storage";
import { getDeviceId } from "@/lib/device";
import { getClientIpPlaceholder } from "@/lib/device";
import { haversineMeters, type GeoPosition, isLikelyMockedPosition } from "@/lib/geo";
import type { AttendanceRecord } from "@/types";
import { log } from "@/lib/audit";
import { todayKey } from "@/lib/utils";
import { addNotification } from "@/lib/notifications";

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

export function todayRecords(employeeId: string) {
  const t = todayKey();
  return getAttendance().filter(
    (r) => r.employeeId === employeeId && r.timestamp.startsWith(t)
  );
}

// دالة مساعدة لتحويل دقائق الفرق إلى نص يوضح الساعات والدقائق
function formatMinutesToText(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  } else if (hours > 0) {
    return `${hours} ساعة`;
  } else {
    return `${minutes} دقيقة`;
  }
}

export async function recordAttendance(args: RecordArgs): Promise<RecordResult> {
  const s = getSettings();
  const emp = findEmployeeByJobNumber(args.jobNumber);
  const deviceId = getDeviceId();

  if (!emp) {
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

  if (emp.status !== "active") {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: args.type,
      result: "rejected",
      reason: "الحساب موقوف",
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return { ok: false, reason: "الحساب موقوف" };
  }

  // 1. ربط الجهاز تلقائياً أو التثبت منه
  if (!emp.deviceId) {
    emp.deviceId = deviceId;
  } else if (emp.deviceId !== deviceId) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: args.type,
      result: "rejected",
      reason: "الجهاز الحالي غير مرتبط بحساب هذا الموظف.",
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return {
      ok: false,
      reason: "الجهاز الحالي غير موثّق لهذا الحساب. يرجى استخدام جهازك المسجل.",
    };
  }

  // 2. التحقق من رمز QR
  const isStaticValid = args.qrCode.trim() === s.qrCode?.trim();
  const isDynamicValid = args.qrCode.startsWith("HADIR-");

  if (!isStaticValid && !isDynamicValid) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
      action: args.type,
      result: "rejected",
      reason: "رمز QR غير صحيح",
      lat: args.position.lat,
      lng: args.position.lng,
    });
    return { ok: false, reason: "رمز QR غير صحيح أو غير متوافق" };
  }

  // 3. التحقق من التزييف (Mock Location)
  try {
    const check = await isLikelyMockedPosition(args.position);
    if (check.mocked) {
      log({
        employeeId: emp.id,
        jobNumber: args.jobNumber,
        actorName: emp.name,
        action: args.type,
        result: "rejected",
        reason: `موقع مزيّف محتمل: ${check.reasons.join("; ")}`,
        lat: args.position.lat,
        lng: args.position.lng,
      });
      return {
        ok: false,
        reason: "تعذّر التحقق من موقعك. يُرجى تعطيل تطبيقات تغيير الموقع.",
      };
    }
  } catch {
    // يتجاوز الفحص إذا تعذر الاتصال بالسيرفر
  }

  // 4. تحديد موقع العمل والمسافة
  const assignedLocation = s.locations?.find((loc) => loc.id === emp.locationId);
  const targetLat = assignedLocation ? assignedLocation.lat : s.workSiteLat;
  const targetLng = assignedLocation ? assignedLocation.lng : s.workSiteLng;
  const targetRadius = assignedLocation ? assignedLocation.radiusMeters : s.radiusMeters;

  const distance = haversineMeters(args.position, {
    lat: targetLat,
    lng: targetLng,
  });

  if (distance > targetRadius) {
    log({
      employeeId: emp.id,
      jobNumber: emp.jobNumber,
      actorName: emp.name,
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

  // 5. التحقق من السجلات المكررة فقط
  const todays = todayRecords(emp.id);
  if (args.type === "check-in") {
    if (todays.some((r) => r.type === "check-in")) {
      return { ok: false, reason: "تم تسجيل الحضور مسبقًا لهذا اليوم", distance };
    }
  } else {
    if (todays.some((r) => r.type === "check-out")) {
      return { ok: false, reason: "تم تسجيل الانصراف مسبقًا لهذا اليوم", distance };
    }
  }

  // 6. احتساب وقت الدوام والتأخير / الانصراف المبكر
  const now = new Date();
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let timeNote = "";

  if (args.type === "check-in" && s.workStart) {
    const [startH, startM] = s.workStart.split(":").map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(startH, startM, 0, 0);

    const diffMinutes = Math.round((now.getTime() - scheduledStart.getTime()) / 60000);
    const grace = s.lateGraceMinutes || 0;

    if (diffMinutes > grace) {
      lateMinutes = diffMinutes;
      timeNote = `تم تسجيل الحضور متاخراً بمقدار (${formatMinutesToText(lateMinutes)})`;
    } else {
      timeNote = "تم تسجيل الحضور في الوقت المحدد";
    }
  } else if (args.type === "check-out" && s.workEnd) {
    const [endH, endM] = s.workEnd.split(":").map(Number);
    const scheduledEnd = new Date(now);
    scheduledEnd.setHours(endH, endM, 0, 0);

    const diffMinutes = Math.round((scheduledEnd.getTime() - now.getTime()) / 60000);

    if (diffMinutes > 0) {
      earlyMinutes = diffMinutes;
      timeNote = `تم تسجيل الانصراف مبكراً بمقدار (${formatMinutesToText(earlyMinutes)})`;
    } else {
      timeNote = "تم تسجيل الانصراف في الوقت المحدد";
    }
  }

  // 7. حفظ السجل
  const rec: AttendanceRecord = {
    id: crypto.randomUUID(),
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    employeeName: emp.name,
    type: args.type,
    timestamp: now.toISOString(),
    lat: args.position.lat,
    lng: args.position.lng,
    distanceMeters: distance,
    deviceId,
    ip: getClientIpPlaceholder(),
    qrCode: args.qrCode,
    locationId: assignedLocation?.id || "main",
  };
  addAttendance(rec);

  log({
    employeeId: emp.id,
    jobNumber: emp.jobNumber,
    actorName: emp.name,
    action: args.type,
    result: "success",
    reason: timeNote,
    lat: args.position.lat,
    lng: args.position.lng,
    distanceMeters: distance,
  });

  // 8. إرسال الإشعارات الفورية
  const actionTitle = args.type === "check-in" ? "تسجيل حضور" : "تسجيل انصراف";

  // إشعار للموظف
  addNotification({
    userId: emp.jobNumber,
    title: `تم ${actionTitle} بنجاح`,
    body: `${timeNote}.`,
    type: "success",
  });

  // إشعار للمدير
  addNotification({
    userId: "admin",
    title: `سجل جديد: ${actionTitle}`,
    body: `قام الموظف (${emp.name}) بـ ${actionTitle}. (${timeNote})`,
    type: "info",
  });

  return {
    ok: true,
    record: rec,
    distance,
    lateMinutes,
    earlyMinutes,
    timeNote,
  };
}
