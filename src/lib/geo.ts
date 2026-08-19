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
      reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
      },
      (e) => {
        let msg = "تعذر تحديد الموقع الجغرافي.";
        if (e.code === 1) {
          msg = "تم رفض إذن الوصول للموقع. يرجى السماح للمتصفح بالوصول إلى الموقع من إعدادات الجوال.";
        } else if (e.code === 2) {
          msg = "تعذر تحديد مكانك من قِبل الأقمار الصناعية (GPS)، تأكد من تفعيل خدمة الموقع في جهازك.";
        } else if (e.code === 3) {
          msg = "انتهت مهلة استجابة الـ GPS. تأكد من قوة الإشارة أو الوقوف في مكان مكشوف.";
        }
        reject(new Error(msg));
      },
      { 
        enableHighAccuracy: true, 
        timeout: 20000, // مهلة 20 ثانية كافية لالتقاط إشارة دقيقة
        maximumAge: 0 
      }
    );
  });
}

export async function isLikelyMockedPosition(
  pos: GeoPosition,
  options?: { prevPositions?: (GeoPosition & { timestamp?: number })[] }
): Promise<{ mocked: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const prev = options?.prevPositions ?? [];

  if (pos.accuracy === 0) {
    reasons.push("دقة الـ GPS غير صالحة (0m)");
  }

  if (prev.length > 0) {
    const last = prev[prev.length - 1];
    const d = haversineMeters({ lat: last.lat, lng: last.lng }, pos);
    const dt = Math.abs(Date.now() - (last.timestamp ?? Date.now()));
    if (d > 80000 && dt < 1000 * 60) {
      reasons.push("قفزة مكانية غير منطقية");
    }
  }

  return { mocked: reasons.length > 0, reasons };
}
