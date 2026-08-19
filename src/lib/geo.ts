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
      (err) => {
        if (isDone) return;
        
        // 3. المحاولة الثانية (المنقذة): طلب دقة عادية (تعمل فوراً داخل المباني)
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => {
            if (isDone) return;
            isDone = true;
            clearTimeout(safetyTimer);
            
            if (err2.code === 1 || err.code === 1) {
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
