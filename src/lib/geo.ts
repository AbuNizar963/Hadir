// src/lib/geo.ts

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

// دالة حساب المسافة بالمتر بين نقطتين (Haversine Formula)
export function haversineMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3; // نصف قطر الأرض بالمتر
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// دالة التحقق من التزييف (Mock Location Check)
export async function isLikelyMockedPosition(_pos: GeoPosition): Promise<{ mocked: boolean; reasons: string[] }> {
  // يمكنك تطوير منطق الفحص هنا مستقبلاً
  // حالياً تعيد false لضمان عدم حظر المستخدمين النظاميين
  return { mocked: false, reasons: [] };
}

// دالة جلب الموقع الجغرافي الحالية مع دعم تدرج الدقة (High Accuracy Fallback)
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي."));
      return;
    }

    let isDone = false;

    // مؤقت أمان في حال علق الـ GPS
    const safetyTimer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        reject(new Error("انتهت مهلة استجابة الـ GPS. تأكد من تفعيل الموقع."));
      }
    }, 15000);

    const onSuccess = (p: GeolocationPosition) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(safetyTimer);
      resolve({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      });
    };

    // المحاولة الأولى (دقة عالية)
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => {
        if (isDone) return;
        
        // المحاولة الثانية (دقة عادية في حال فشل الأولى)
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => {
            if (isDone) return;
            isDone = true;
            clearTimeout(safetyTimer);
            
            if (err2.code === 1) {
              reject(new Error("تم رفض صلاحية الموقع. يرجى السماح للمتصفح بالوصول لموقعك."));
            } else {
              reject(new Error("تعذر تحديد موقعك. تأكد من تفعيل الـ GPS في الجوال."));
            }
          },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  });
}

// دالة لجلب معرف الجهاز (لاستخدامها في نظام التدقيق)
export function getDeviceId(): string {
  let id = localStorage.getItem("hadir.device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("hadir.device_id", id);
  }
  return id;
}

// دالة placeholder لعنوان IP (يتم استبدالها برابط API حقيقي عند الحاجة)
export function getClientIpPlaceholder(): string {
  return "127.0.0.1";
}
