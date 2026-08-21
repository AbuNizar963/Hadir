export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type Coordinates = Pick<GeoPosition, "lat" | "lng">;

const EARTH_RADIUS_METERS = 6_371_000;
const COORDINATE_DECIMALS = 7;
const GPS_TIMEOUT_MS = 10_000;

export function roundCoordinate(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(COORDINATE_DECIMALS)) : value;
}

export function roundDistanceMeters(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : value;
}

export function normalizeCoordinates(value: Coordinates): Coordinates {
  return { lat: roundCoordinate(value.lat), lng: roundCoordinate(value.lng) };
}

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
  const a = normalizeCoordinates(p1);
  const b = normalizeCoordinates(p2);
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const haversineA = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const safeA = Math.min(1, Math.max(0, haversineA));
  return roundDistanceMeters(EARTH_RADIUS_METERS * (2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))));
}

export function isInsideGeofence(
  employee: Coordinates,
  workplace: Coordinates,
  radiusMeters: number,
): { allowed: boolean; distanceMeters: number } {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new Error("نطاق موقع العمل غير صالح.");
  const distanceMeters = haversineMeters(employee, workplace);
  return { allowed: distanceMeters <= roundDistanceMeters(radiusMeters), distanceMeters };
}

export async function isLikelyMockedPosition(_pos: GeoPosition): Promise<{ mocked: boolean; reasons: string[] }> {
  return { mocked: false, reasons: [] };
}

async function loadFreshEmployeeWorkplace(): Promise<Coordinates & { radiusMeters: number }> {
  if (typeof window === "undefined") throw new Error("تحديد الموقع متاح من المتصفح فقط.");
  const employeeToken = localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.auth.token.employee");
  if (!employeeToken) throw new Error("جلسة الموظف غير موجودة. يرجى تسجيل الدخول مرة أخرى.");
  const { getBackendEmployeeLocation } = await import("@/lib/backend");
  const { location } = await getBackendEmployeeLocation();
  const lat = roundCoordinate(Number(location.lat));
  const lng = roundCoordinate(Number(location.lng));
  const radiusMeters = roundDistanceMeters(Number(location.radiusMeters));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new Error("بيانات موقع العمل في قاعدة بيانات D1 غير صالحة.");
  }
  return { lat, lng, radiusMeters };
}

export function getCurrentPosition(options: PositionOptions = {}): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي."));
      return;
    }

    let settled = false;
    let workplace: (Coordinates & { radiusMeters: number }) | null = null;
    const finish = (result: GeoPosition | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      result instanceof Error ? reject(result) : resolve(result);
    };
    const timeoutMs = GPS_TIMEOUT_MS;
    const timer = setTimeout(() => {
      finish(new Error("انتهت مهلة تحديد الموقع. فعّل GPS وخدمات الموقع وحاول مرة أخرى."));
    }, timeoutMs + 750);

    const getFreshWorkplace = async () => {
      try {
        workplace = await loadFreshEmployeeWorkplace();
      } catch (error) {
        finish(error instanceof Error ? error : new Error("تعذر تحميل موقع العمل الحالي من D1."));
      }
    };

    void getFreshWorkplace().then(() => {
      if (settled) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const result: GeoPosition = {
            lat: roundCoordinate(position.coords.latitude),
            lng: roundCoordinate(position.coords.longitude),
            accuracy: Number.isFinite(position.coords.accuracy) ? roundDistanceMeters(position.coords.accuracy) : undefined,
          };
          if (!isValidGeoPosition(result)) {
            finish(new Error("تعذر الحصول على إحداثيات GPS صالحة."));
            return;
          }
          if (workplace) {
            const distance = haversineMeters(result, workplace);
            if (distance > workplace.radiusMeters) {
              finish(new Error(`أنت خارج نطاق موقع العمل الحالي. المسافة ${distance} م، والحد ${workplace.radiusMeters} م.`));
              return;
            }
          }
          finish(result);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) finish(new Error("تم رفض إذن الموقع. اسمح للمتصفح بالوصول إلى GPS ثم حاول مرة أخرى."));
          else if (error.code === error.POSITION_UNAVAILABLE) finish(new Error("تعذر تحديد موقعك الحقيقي. تأكد من تشغيل GPS وخدمات الموقع."));
          else finish(new Error("انتهت مهلة تحديد الموقع. فعّل GPS وحاول مرة أخرى."));
        },
        {
          ...options,
          enableHighAccuracy: true,
          timeout: GPS_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    });
  });
}
