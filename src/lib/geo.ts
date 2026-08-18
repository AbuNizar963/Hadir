export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      (e) => {
        const msg =
          e.code === 1
            ? "تم رفض إذن تحديد الموقع. يرجى تفعيل الموقع من إعدادات المتصفح."
            : e.code === 2
            ? "تعذر تحديد الموقع الجغرافي للجهاز."
            : "انتهت مهلة استجابة الـ GPS.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * فحص ذكي وموثوق للكشف عن المواقع المزيفة بدون التسبب في حظر مستخدمي شبكات الجوال (4G/5G)
 */
export async function isLikelyMockedPosition(
  pos: GeoPosition,
  options?: { prevPositions?: (GeoPosition & { timestamp?: number })[] }
): Promise<{ mocked: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const prev = options?.prevPositions ?? [];

  // فحص دقة الـ GPS: إذا كانت الدقة 0 أو غير منطقية
  if (pos.accuracy === 0) {
    reasons.push("دقة الـ GPS غير صالحة (0m)");
  }

  // فحص القفزات اللحظية المستحيلة (أكثر من 80 كم في أقل من دقيقة)
  if (prev.length > 0) {
    const last = prev[prev.length - 1];
    const d = haversineMeters({ lat: last.lat, lng: last.lng }, pos);
    const dt = Math.abs(Date.now() - (last.timestamp ?? Date.now()));
    if (d > 80000 && dt < 1000 * 60) {
      reasons.push("قفزة مكانية غير منطقية بسرعة تفوق سرعة الطيران");
    }
  }

  // ملاحظة: تم إلغاء مقارنة الـ IP هنا لمنع حظر موظفي شبكات الجوال الذين تختلف لديهم مواقع الأبراج.

  return { mocked: reasons.length > 0, reasons };
}
