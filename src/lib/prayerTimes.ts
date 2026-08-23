export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface PrayerMeta {
  gregorian: string;
  hijri: string;
  city: string;
}

export interface PrayerLocation {
  latitude: number;
  longitude: number;
  city?: string;
}

export interface PrayerResponse {
  times: PrayerTimes;
  meta: PrayerMeta;
}

const FALLBACK: PrayerTimes = {
  fajr: "--:--",
  sunrise: "--:--",
  dhuhr: "--:--",
  asr: "--:--",
  maghrib: "--:--",
  isha: "--:--",
};

const CITY_FALLBACK = "موقعك الحالي";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const normalize = (value: number) => (value % 360 + 360) % 360;

function validCoordinate(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function clean(value?: string) {
  if (typeof value !== "string") return "--:--";
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return "--:--";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return TIME_PATTERN.test(normalized) ? normalized : "--:--";
}

function createAbortSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export async function getPrayerTimes(location: PrayerLocation, date = new Date()): Promise<PrayerResponse> {
  if (!validCoordinate(location.latitude, -90, 90) || !validCoordinate(location.longitude, -180, 180)) {
    throw new Error("Invalid prayer coordinates");
  }

  const dateKey = `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    method: "3", // Muslim World League
  });
  const response = await fetch(`https://api.aladhan.com/v1/timings/${dateKey}?${query.toString()}`, {
    cache: "no-store",
    signal: createAbortSignal(10000),
  });
  if (!response.ok) throw new Error(`Prayer times unavailable:${response.status}`);

  const json = await response.json() as {
    data?: {
      timings?: Record<string, string>;
      date?: {
        readable?: string;
        hijri?: { date?: string; month?: { ar?: string }; year?: string };
      };
    };
  };
  const data = json.data;
  const timings = data?.timings;
  if (!timings) {
    return { times: FALLBACK, meta: { gregorian: "", hijri: "", city: location.city || CITY_FALLBACK } };
  }

  const hijriParts = data?.date?.hijri?.date?.split("-") || [];
  const hijri = hijriParts.length === 3
    ? `${hijriParts[0]} ${data?.date?.hijri?.month?.ar || ""} ${data?.date?.hijri?.year || ""} هـ`
    : "";

  return {
    times: {
      fajr: clean(timings.Fajr),
      sunrise: clean(timings.Sunrise),
      dhuhr: clean(timings.Dhuhr),
      asr: clean(timings.Asr),
      maghrib: clean(timings.Maghrib),
      isha: clean(timings.Isha),
    },
    meta: {
      gregorian: data?.date?.readable || "",
      hijri,
      city: location.city || CITY_FALLBACK,
    },
  };
}

export async function getQiblaBearingFromProvider(latitude: number, longitude: number): Promise<number> {
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    throw new Error("Invalid Qibla coordinates");
  }
  const response = await fetch(`https://api.aladhan.com/v1/qibla/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`, {
    cache: "no-store",
    signal: createAbortSignal(8000),
  });
  if (!response.ok) throw new Error(`Qibla provider unavailable:${response.status}`);
  const json = await response.json() as { data?: { direction?: unknown } };
  const direction = json.data?.direction;
  if (typeof direction !== "number" || !Number.isFinite(direction)) throw new Error("Invalid Qibla direction");
  return normalize(direction);
}

export function qiblaBearing(latitude: number, longitude: number): number {
  const kaabaLat = 21.422487 * Math.PI / 180;
  const kaabaLon = 39.826206 * Math.PI / 180;
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  const dLon = kaabaLon - lon;
  const y = Math.sin(dLon);
  const x = Math.cos(lat) * Math.tan(kaabaLat) - Math.sin(lat) * Math.cos(dLon);
  return normalize(Math.atan2(y, x) * 180 / Math.PI);
}

export function distanceToKaabaKm(latitude: number, longitude: number) {
  const radius = 6371;
  const lat1 = latitude * Math.PI / 180;
  const lat2 = 21.422487 * Math.PI / 180;
  const dLat = (21.422487 - latitude) * Math.PI / 180;
  const dLon = (39.826206 - longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function bearingLabel(deg: number) {
  const directions = ["شمال", "شمال شرقي", "شرق", "جنوب شرقي", "جنوب", "جنوب غربي", "غرب", "شمال غربي"];
  return directions[Math.round(normalize(deg) / 45) % directions.length];
}
