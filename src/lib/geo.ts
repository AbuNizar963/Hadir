export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type Coordinates = Pick<GeoPosition, "lat" | "lng">;

const EARTH_RADIUS_METERS = 6_371_000;

export function isValidGeoPosition(position: GeoPosition): boolean {
  return Number.isFinite(position.lat)
    && Number.isFinite(position.lng)
    && position.lat >= -90
    && position.lat <= 90
    && position.lng >= -180
    && position.lng <= 180
    && (position.accuracy === undefined || (Number.isFinite(position.accuracy) && position.accuracy >= 0));
}

export function haversineMeters(p1: Coordinates, p2: Coordinates): number {
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const safeA = Math.min(1, Math.max(0, a));
  return Math.round(EARTH_RADIUS_METERS * (2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))));
}

export function isInsideGeofence(
  employee: Coordinates,
  workplace: Coordinates,
  radiusMeters: number,
): { allowed: boolean; distanceMeters: number } {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new Error("نطاق موقع العمل غير صالح.");
  }
  const distanceMeters = haversineMeters(employee, workplace);
  return { allowed: distanceMeters <= radiusMeters, distanceMeters };
}

export async function isLikelyMockedPosition(_pos: GeoPosition): Promise<{ mocked: boolean; reasons: string[] }> {
  return { mocked: false, reasons: [] };
}

export function getCurrentPosition(options: PositionOptions = {}): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي.") );
      return;
    }

    let settled = false;
    const timeoutMs = options.timeout ?? 15000;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("انتهت مهلة تحديد الموقع. فعّل GPS وحاول مرة أخرى."));
      }
    }, timeoutMs + 1000);

    const finish = (result: GeoPosition | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      result instanceof Error ? reject(result) : resolve(result);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result: GeoPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (!isValidGeoPosition(result)) {
          finish(new Error("تعذر الحصول على إحداثيات GPS صالحة."));
          return;
        }
        finish(result);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(new Error("تم رفض إذن الموقع. اسمح للمتصفح بالوصول إلى GPS ثم حاول مرة أخرى."));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          finish(new Error("تعذر تحديد موقعك. تأكد من تشغيل GPS وخدمات الموقع."));
        } else {
          finish(new Error("انتهت مهلة تحديد الموقع. حاول مرة أخرى."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: options.maximumAge ?? 0,
      },
    );
  });
}
