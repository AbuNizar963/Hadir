export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type Coordinates = Pick<GeoPosition, "lat" | "lng">;

const EARTH_RADIUS_METERS = 6_371_000;
const COORDINATE_DECIMALS = 7;
const LOCATION_WATCH_TIMEOUT_MS = 35_000;
const LOCATION_TARGET_ACCURACY_METERS = 30;
const LOCATION_MAX_ACCEPTED_ACCURACY_METERS = 60;
const LOCATION_STABILITY_DISTANCE_METERS = 20;
const LOCATION_STABLE_SAMPLES_REQUIRED = 2;

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
  return roundDistanceMeters(
    EARTH_RADIUS_METERS * (2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))),
  );
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
  return { allowed: distanceMeters <= roundDistanceMeters(radiusMeters), distanceMeters };
}

export async function isLikelyMockedPosition(_pos: GeoPosition): Promise<{ mocked: boolean; reasons: string[] }> {
  return { mocked: false, reasons: [] };
}

async function loadFreshEmployeeWorkplace(): Promise<Coordinates & { radiusMeters: number }> {
  if (typeof window === "undefined") throw new Error("تحديد الموقع متاح من المتصفح فقط.");
  const employeeToken = localStorage.getItem("hadir.api.token.employee")
    || localStorage.getItem("hadir.auth.token.employee");
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
    return new Error(
      `الجهاز لم يوفر موقعًا صالحًا الآن. تأكد من GPS/خدمات الموقع والاتصال، ثم حاول مرة أخرى. ${permissionHint()}`,
    );
  }
  return new Error(
    `لم يصل الموقع خلال المهلة المحددة. اترك الشاشة مفتوحة عدة ثوانٍ وحاول مرة أخرى. ${permissionHint()}`,
  );
}

function readPosition(position: GeolocationPosition): GeoPosition {
  const accuracy = Number.isFinite(position.coords.accuracy)
    ? roundDistanceMeters(position.coords.accuracy)
    : undefined;
  const result: GeoPosition = {
    lat: roundCoordinate(position.coords.latitude),
    lng: roundCoordinate(position.coords.longitude),
    accuracy,
  };
  if (!isValidGeoPosition(result)) throw new Error("تعذر الحصول على إحداثيات GPS صالحة.");
  return result;
}

function requestWatchedPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let best: GeoPosition | null = null;
    let stableSamples = 0;
    let previousAccepted: GeoPosition | null = null;

    const timer = window.setTimeout(() => {
      if (settled) return;
      if (best && (best.accuracy ?? Number.POSITIVE_INFINITY) <= LOCATION_MAX_ACCEPTED_ACCURACY_METERS) {
        finish(best);
        return;
      }
      finish(
        undefined,
        new Error(
          `لم نتمكن من الحصول على GPS بدقة كافية. دقة الجهاز الحالية: ${best?.accuracy ?? "غير معروفة"}م. ${permissionHint()}`,
        ),
      );
    }, LOCATION_WATCH_TIMEOUT_MS);

    const finish = (value?: GeoPosition, error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      value ? resolve(value) : reject(error ?? new Error("تعذر تحديد الموقع."));
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          try {
            const candidate = readPosition(position);
            const accuracy = candidate.accuracy ?? Number.POSITIVE_INFINITY;

            if (!best || accuracy < (best.accuracy ?? Number.POSITIVE_INFINITY)) {
              best = candidate;
            }

            if (accuracy <= LOCATION_MAX_ACCEPTED_ACCURACY_METERS) {
              const isStable = previousAccepted !== null
                && haversineMeters(previousAccepted, candidate) <= LOCATION_STABILITY_DISTANCE_METERS;
              stableSamples = isStable ? stableSamples + 1 : 1;
              previousAccepted = candidate;
            }

            if (accuracy <= LOCATION_TARGET_ACCURACY_METERS && stableSamples >= LOCATION_STABLE_SAMPLES_REQUIRED) {
              finish(candidate);
            }
          } catch {
            // Ignore malformed browser samples and keep the GPS watcher alive.
          }
        },
        (error) => finish(undefined, browserLocationError(error)),
        {
          enableHighAccuracy: true,
          timeout: LOCATION_WATCH_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    } catch (error) {
      finish(undefined, error instanceof Error ? error : new Error("تعذر تشغيل GPS."));
    }
  });
}

export async function getCurrentPosition(_options: PositionOptions = {}): Promise<GeoPosition> {
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

  // Do not fall back to network/IP positioning for attendance. A low-accuracy
  // fallback is the exact failure mode that can produce 50–200m offsets.
  // watchPosition lets the browser refine Wi-Fi/cell positioning into a GPS fix.
  return requestWatchedPosition();
}
