export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type Coordinates = Pick<GeoPosition, "lat" | "lng">;

const EARTH_RADIUS_METERS = 6_371_000;
const COORDINATE_DECIMALS = 7;
const HIGH_ACCURACY_TIMEOUT_MS = 18_000;
const FALLBACK_TIMEOUT_MS = 25_000;
const WATCH_GRACE_MS = 2_000;

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

function permissionHint(): string {
  return "اسمح للموقع من إعدادات المتصفح والنظام، فعّل خدمات الموقع/GPS، ثم أعد المحاولة.";
}

async function queryLocationPermission(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return null;
  }
}

function browserLocationError(error: GeolocationPositionError): Error {
  if (error.code === error.PERMISSION_DENIED) {
    return new Error(`تم رفض إذن الموقع. ${permissionHint()}`);
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return new Error(`الجهاز لم يوفر موقعًا صالحًا الآن. تأكد من GPS/خدمات الموقع والاتصال، ثم حاول مرة أخرى. ${permissionHint()}`);
  }
  return new Error(`لم يصل الموقع خلال المهلة المحددة. اترك الشاشة مفتوحة عدة ثوانٍ وحاول مرة أخرى. ${permissionHint()}`);
}

function readPosition(position: GeolocationPosition): GeoPosition {
  const result: GeoPosition = {
    lat: roundCoordinate(position.coords.latitude),
    lng: roundCoordinate(position.coords.longitude),
    accuracy: Number.isFinite(position.coords.accuracy)
      ? roundDistanceMeters(position.coords.accuracy)
      : undefined,
  };
  if (!isValidGeoPosition(result)) throw new Error("تعذر الحصول على إحداثيات GPS صالحة.");
  return result;
}

function requestPosition(options: PositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try { resolve(readPosition(position)); }
        catch (error) { reject(error); }
      },
      (error) => reject(browserLocationError(error)),
      options,
    );
  });
}

function requestWatchedPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let best: GeoPosition | null = null;
    let watchId: number | null = null;
    const finish = (value?: GeoPosition, error?: Error) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      value ? resolve(value) : reject(error ?? new Error("تعذر تحديد الموقع."));
    };
    const timer = window.setTimeout(() => finish(best ?? undefined, best ? undefined : new Error(`تعذر تحديد موقعك بدقة كافية. ${permissionHint()}`)), FALLBACK_TIMEOUT_MS + WATCH_GRACE_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        try {
          const candidate = readPosition(position);
          if (!best || (candidate.accuracy ?? Number.POSITIVE_INFINITY) < (best.accuracy ?? Number.POSITIVE_INFINITY)) best = candidate;
          if ((candidate.accuracy ?? Number.POSITIVE_INFINITY) <= 50) {
            window.clearTimeout(timer);
            finish(candidate);
          }
        } catch {
          // Ignore malformed samples and continue watching.
        }
      },
      (error) => {
        window.clearTimeout(timer);
        finish(best ?? undefined, browserLocationError(error));
      },
      { enableHighAccuracy: true, timeout: FALLBACK_TIMEOUT_MS, maximumAge: 5_000 },
    );
  });
}

export async function getCurrentPosition(options: PositionOptions = {}): Promise<GeoPosition> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("تحديد الموقع متاح من المتصفح فقط.");
  }
  if (!window.isSecureContext) {
    throw new Error("تحديد الموقع يتطلب اتصال HTTPS آمنًا. افتح الموقع من الرابط الرسمي الآمن ثم حاول مرة أخرى.");
  }
  if (!navigator.geolocation) {
    throw new Error("هذا المتصفح لا يدعم تحديد الموقع الجغرافي.");
  }

  const permission = await queryLocationPermission();
  if (permission === "denied") {
    throw new Error(`إذن الموقع محظور لهذا الموقع. ${permissionHint()}`);
  }

  // First ask for the best available GPS result. A longer timeout is
  // intentional: cold GPS fixes commonly need more than 10 seconds.
  try {
    return await requestPosition({
      ...options,
      enableHighAccuracy: true,
      timeout: HIGH_ACCURACY_TIMEOUT_MS,
      maximumAge: 0,
    });
  } catch (firstError) {
    if (firstError instanceof Error && firstError.message.includes("تم رفض إذن الموقع")) throw firstError;

    // Some phones/browser shells expose a network-based position more reliably
    // when high-accuracy GPS is unavailable. Try a fresh lower-power fix.
    try {
      return await requestPosition({
        ...options,
        enableHighAccuracy: false,
        timeout: FALLBACK_TIMEOUT_MS,
        maximumAge: 10_000,
      });
    } catch (secondError) {
      if (secondError instanceof Error && secondError.message.includes("تم رفض إذن الموقع")) throw secondError;
      try {
        return await requestWatchedPosition();
      } catch {
        throw secondError instanceof Error ? secondError : firstError;
      }
    }
  }
}
