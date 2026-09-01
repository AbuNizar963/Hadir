import { addAttendance, findEmployeeByJobNumber, getAttendance, getEmployees, getSettings, saveEmployees } from "@/lib/storage";
import { createBackendAttendance, getBackendAttendance, getBackendEmployeeLocation, getBackendEmployeeProfile, getBackendSettings, getBackendRequests, backendEnabled } from "@/lib/backend";
import { getDeviceId, getClientIpPlaceholder } from "@/lib/device";
import { haversineMeters, isValidGeoPosition, isLikelyMockedPosition, type GeoPosition } from "@/lib/geo";
import type { AttendanceRecord, Employee } from "@/types";
import { log } from "@/lib/audit";
import { getActiveWorkPeriod, getEmployeeWorkPeriod } from "@/lib/schedule";

export interface RecordArgs { jobNumber: string; type: "check-in" | "check-out"; position: GeoPosition; qrCode: string; }
export interface RecordResult { 
  ok: boolean; 
  reason?: string; 
  record?: AttendanceRecord; 
  distance?: number; 
  lateMinutes?: number; 
  earlyMinutes?: number; 
  timeNote?: string;
  isOffline?: boolean;
}

function formatMinutesToText(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}ساعة و${minutes}دقيقة`;
  if (hours) return `${hours}ساعة`;
  return `${minutes}دقيقة`;
}

function recordsForPeriod(employeeId: string, periodStart: Date | null, periodEnd: Date | null): AttendanceRecord[] {
  const all = getAttendance().filter((record) => record.employeeId === employeeId);
  if (!periodStart) return all;
  return all.filter((record) => {
    const t = new Date(record.timestamp).getTime();
    return t >= periodStart.getTime() && (!periodEnd || t <= periodEnd.getTime() + 60_000);
  }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function todayRecords(employeeId: string): AttendanceRecord[] {
  const employee = getEmployees().find((item) => item.id === employeeId);
  if (!employee) return getAttendance().filter((r) => r.employeeId === employeeId);
  const period = getActiveWorkPeriod(employee, new Date());
  return recordsForPeriod(employeeId, period.start, period.end);
}

export async function recordAttendance(args: RecordArgs): Promise<RecordResult> {
  let settings = getSettings();
  let backendAvailable = true;

  if (backendEnabled) {
    try {
      const cloud = await getBackendSettings();
      settings = { ...settings, ...cloud, adminAccounts: Array.isArray(cloud.adminAccounts) ? cloud.adminAccounts : settings.adminAccounts };
    } catch (error) {
      console.warn("⚠️ تعذر تحميل الإعدادات من D1، سيتم استخدام الإعدادات المحلية:", error);
      // Continue with local settings
    }
  }

  let employee: Employee | null = null;
  if (backendEnabled) {
    try {
      employee = await getBackendEmployeeProfile();
      if (String(employee.jobNumber).trim() !== String(args.jobNumber).trim())
        return { ok: false, reason: "جلسة الموظف لا تطابق الرقم الوظيفي المدخل" };
    } catch (error) {
      console.warn("⚠️ تعذر تحميل بيانات الموظف من D1، سيتم استخدام البيانات المحلية:", error);
      backendAvailable = false;
      employee = findEmployeeByJobNumber(args.jobNumber);
    }
  } else {
    employee = findEmployeeByJobNumber(args.jobNumber);
  }

  if (!employee) return { ok: false, reason: "الموظف غير موجود" };
  if (employee.status !== "active") return { ok: false, reason: "الحساب موقوف" };
  if (!isValidGeoPosition(args.position)) return { ok: false, reason: "تعذر التحقق من موقعك. يرجى إعادة محاولة تحديد الموقع." };

  const now = new Date();
  const currentPeriod = getEmployeeWorkPeriod(employee, now);

  let allEmployeeRecords: AttendanceRecord[];
  let usedOfflineData = false;

  if (backendEnabled && backendAvailable) {
    try {
      const remoteRecords = await getBackendAttendance(500);
      allEmployeeRecords = (Array.isArray(remoteRecords) ? remoteRecords : [])
        .filter((r: any) => String(r.employeeId || "") === String(employee!.id))
        .sort((a: any, b: any) => new Date(String(b.timestamp)).getTime() - new Date(String(a.timestamp)).getTime());
    } catch (error) {
      console.warn("⚠️ تعذر تحميل سجل الموظف من D1، سيتم استخدام السجل المحلي مؤقتًا:", error);
      usedOfflineData = true;
      allEmployeeRecords = getAttendance()
        .filter((r) => r.employeeId === employee!.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } else {
    usedOfflineData = !backendAvailable;
    allEmployeeRecords = getAttendance()
      .filter((r) => r.employeeId === employee!.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  const last = allEmployeeRecords[0];
  const openSession = last?.type === "check-in";

  if (args.type === "check-in") {
    if (!currentPeriod.isWorkDay || !currentPeriod.start || !currentPeriod.end) {
      return {
        ok: false,
        reason: `لا يوجد دوام للموظف الآن: ${currentPeriod.label}${currentPeriod.detail ? ` · ${currentPeriod.detail}` : ""}`,
        isOffline: usedOfflineData,
      };
    }
    const periodRecords = recordsForPeriod(employee.id, currentPeriod.start, currentPeriod.end);
    if (periodRecords.some((r) => r.type === "check-in")) {
      return { ok: false, reason: "تم تسجيل الحضور مسبقًا لهذه الفترة", isOffline: usedOfflineData };
    }
  } else if (!openSession) {
    return { ok: false, reason: "لا يمكن تسجيل الانصراف قبل تسجيل الحضور", isOffline: usedOfflineData };
  }

  const deviceId = getDeviceId();
  if (!employee.deviceId) {
    const employees = getEmployees();
    const index = employees.findIndex((item) => item.id === employee!.id);
    if (index >= 0) {
      employees[index] = { ...employees[index], deviceId };
      saveEmployees(employees);
    }
  } else if (employee.deviceId !== deviceId) {
    return { ok: false, reason: "الجهاز الحالي غير موثّق لهذا الحساب. يرجى استخدام الجهاز المسجل.", isOffline: usedOfflineData };
  }

  const submittedQr = args.qrCode.trim();
  const expectedQr = (settings.qrCode || "").trim();
  if (!submittedQr || !expectedQr || submittedQr !== expectedQr)
    return { ok: false, reason: "رمز QR غير صحيح أو لا يخص موقع العمل", isOffline: usedOfflineData };

  const mockCheck = await isLikelyMockedPosition(args.position);
  if (mockCheck.mocked)
    return { ok: false, reason: "تعذّر التحقق من موقعك. يرجى تعطيل أدوات تغيير الموقع.", isOffline: usedOfflineData };

  let targetLat = Number(settings.workSiteLat), targetLng = Number(settings.workSiteLng), targetRadius = Number(settings.radiusMeters), targetLocationId = String(employee.locationId || "main");
  
  if (backendEnabled && backendAvailable) {
    try {
      const remote = await getBackendEmployeeLocation();
      targetLat = Number(remote.location.lat);
      targetLng = Number(remote.location.lng);
      targetRadius = Number(remote.location.radiusMeters);
    } catch (error) {
      console.warn("⚠️ تعذر تحميل موقع الموظف من D1، سيتم استخدام الموقع الافتراضي:", error);
      const assigned = settings.locations?.find((location) => location.id === employee!.locationId);
      targetLat = Number(assigned?.lat ?? settings.workSiteLat);
      targetLng = Number(assigned?.lng ?? settings.workSiteLng);
      targetRadius = Number(assigned?.radiusMeters ?? settings.radiusMeters);
    }
  } else {
    const assigned = settings.locations?.find((location) => location.id === employee!.locationId);
    targetLat = Number(assigned?.lat ?? settings.workSiteLat);
    targetLng = Number(assigned?.lng ?? settings.workSiteLng);
    targetRadius = Number(assigned?.radiusMeters ?? settings.radiusMeters);
  }

  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng) || !Number.isFinite(targetRadius) || targetRadius <= 0)
    return { ok: false, reason: "إعدادات موقع العمل غير صالحة. يرجى التواصل مع الإدارة.", isOffline: usedOfflineData };

  const distance = haversineMeters(args.position, { lat: targetLat, lng: targetLng });
  if (!Number.isFinite(distance) || distance > targetRadius) {
    return {
      ok: false,
      reason: Number.isFinite(distance)
        ? `أنت خارج نطاق مقر العمل. المسافة الحالية: ${Math.round(distance)}م (النطاق المسموح: ${targetRadius}م)`
        : "تعذر حساب المسافة",
      isOffline: usedOfflineData,
    };
  }

  const periodForTiming = args.type === "check-out" && openSession && last ? getActiveWorkPeriod(employee, now) : currentPeriod;
  const start = periodForTiming.start;
  const end = periodForTiming.end;

  // Validate grace period is reasonable
  const maxReasonableGrace = 120; // 2 hours
  const grace = Math.max(0, Math.min(maxReasonableGrace, employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10));

  let lateMinutes = 0, earlyMinutes = 0, timeNote = "";

  if (args.type === "check-in" && start) {
    const diff = Math.round((now.getTime() - start.getTime()) / 60000);
    if (diff > grace) {
      lateMinutes = diff;
      timeNote = `تم تسجيل الحضور متأخراً بمقدار ${formatMinutesToText(lateMinutes)}`;
    }
  }

  if (args.type === "check-out" && end) {
    const diff = Math.round((end.getTime() - now.getTime()) / 60000);
    if (diff > 0) {
      // Early checkout is forbidden for employees unless a manager/owner has approved a checkout request.
      let approvedEarlyCheckout = false;

      if (backendEnabled && backendAvailable) {
        try {
          const requests = await getBackendRequests("employee");
          const today = now.toISOString().slice(0, 10);
          const requestDate = now.toISOString().slice(0, 10);

          // Check if there's an approved checkout request for today or earlier this work period
          approvedEarlyCheckout = Array.isArray(requests) && requests.some((r: any) => {
            const reqType = String(r.type || "").toLowerCase();
            const reqStatus = String(r.status || "").toLowerCase();
            if (reqType !== "checkout" || (reqStatus !== "approved" && reqStatus !== "confirmed")) return false;

            // Allow checkout requests approved on the same day or within the work period
            const startDate = String(r.startDate || r.createdAt || "").slice(0, 10);
            const endDate = String(r.endDate || startDate).slice(0, 10);

            return requestDate >= startDate && requestDate <= endDate;
          });
        } catch (error) {
          console.warn("⚠️ تعذر التحقق من إذن الانصراف المبكر:", error);
        }
      }

      if (!approvedEarlyCheckout) {
        return { ok: false, reason: "لم ينتهِ وقت دوامك بعد", isOffline: usedOfflineData };
      }
      earlyMinutes = diff;
      timeNote = `تم تسجيل الانصراف مبكراً بإذن الإدارة بمقدار ${formatMinutesToText(earlyMinutes)}`;
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
    distance: distance,
    ip: getClientIpPlaceholder(),
  };

  if (backendEnabled && backendAvailable) {
    try {
      await createBackendAttendance({
        employeeId: employee.id,
        jobNumber: employee.jobNumber,
        employeeName: employee.name,
        type: args.type,
        timestamp: record.timestamp,
        lat: record.lat,
        lng: record.lng,
        distance: distance,
      });
    } catch (error) {
      console.warn("⚠️ تعذر حفظ السجل في D1، تم حفظه محليًا:", error);
      usedOfflineData = true;
    }
  }

  addAttendance(record);
  log({
    employeeId: employee.id,
    jobNumber: employee.jobNumber,
    actorName: employee.name,
    action: args.type,
    result: "success",
    reason: timeNote,
    lat: record.lat,
    lng: record.lng,
    distanceMeters: distance,
  });

  return {
    ok: true,
    record,
    distance,
    lateMinutes,
    earlyMinutes,
    timeNote,
    isOffline: usedOfflineData,
  };
}
