export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

// دالة حساب المسافة (إذا لم تكن موجودة لديك أضفها أيضاً لضمان عدم حدوث نقص)
export function haversineMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3;
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

// الدالة الناقصة التي يطلبها ملف attendance.ts
export function isLikelyMockedPosition(_pos: GeoPosition): boolean {
  return false;
}

// الكود الذكي الخاص بك لجلب الموقع بدقة مع fallback
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي."));
      return;
    }

    let isDone = false;

    // 1. مؤقت أمان قسري لمنع تعليق المتصفح للأبد (15 ثانية كحد أقصى)
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

    // 2. المحاولة الأولى: طلب دقة عالية (GPS)
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (_err) => {
        if (isDone) return;
        
        // 3. المحاولة الثانية (المنقذة): طلب دقة عادية (تعمل فوراً داخل المباني)
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => {
            if (isDone) return;
            isDone = true;
            clearTimeout(safetyTimer);
            
            if (err2.code === 1) {
              reject(new Error("تم رفض الصلاحية. يرجى السماح للمتصفح بالوصول لموقعك."));
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
