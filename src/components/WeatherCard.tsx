import { useEffect, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Snowflake, Sun } from "lucide-react";

type WeatherState = {
  temp: number;
  apparent: number;
  code: number;
  wind: number;
  city: string;
  loading: boolean;
  error?: string;
};

type WeatherCardProps = {
  compact?: boolean;
  latitude?: number;
  longitude?: number;
  title?: string;
  className?: string;
  hideWhenWithinKm?: number;
  referenceLatitude?: number;
  referenceLongitude?: number;
};

type OpenMeteoCurrent = {
  temperature_2m?: unknown;
  apparent_temperature?: unknown;
  weather_code?: unknown;
  wind_speed_10m?: unknown;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeWeatherCode = (value: number) => Math.max(0, Math.min(99, Math.round(value)));

function distanceKm(a: number, b: number, c: number, d: number) {
  const radius = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(c - a);
  const longitudeDelta = radians(d - b);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a)) * Math.cos(radians(c)) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function weatherPresentation(code: number, hour: number) {
  const night = hour < 6 || hour >= 19;
  const normalized = normalizeWeatherCode(code);

  if (normalized === 0) {
    return { label: night ? "صافي ليلاً" : "صافي", Icon: night ? Moon : Sun };
  }
  if (normalized <= 3) {
    return { label: night ? "غائم جزئيًا ليلاً" : "غائم جزئيًا", Icon: night ? Cloud : CloudSun };
  }
  if (normalized <= 48) return { label: "ضباب", Icon: CloudFog };
  if (normalized <= 67) return { label: "أمطار", Icon: CloudRain };
  if (normalized <= 77) return { label: "ثلوج", Icon: Snowflake };
  if (normalized <= 82) return { label: "زخات مطر", Icon: CloudRain };
  if (normalized <= 86) return { label: "زخات ثلج", Icon: Snowflake };
  return { label: "عاصفة رعدية", Icon: CloudLightning };
}

async function readWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<WeatherState> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`weather:${response.status}`);

  const payload = await response.json() as { current?: OpenMeteoCurrent };
  const current = payload.current;
  if (!current
    || !isFiniteNumber(current.temperature_2m)
    || !isFiniteNumber(current.apparent_temperature)
    || !isFiniteNumber(current.weather_code)
    || !isFiniteNumber(current.wind_speed_10m)) {
    throw new Error("weather:invalid-response");
  }

  return {
    temp: current.temperature_2m,
    apparent: current.apparent_temperature,
    code: normalizeWeatherCode(current.weather_code),
    wind: Math.max(0, current.wind_speed_10m),
    city: "الموقع",
    loading: false,
  };
}

export default function WeatherCard({
  compact = false,
  latitude,
  longitude,
  title = "الطقس",
  className = "",
  hideWhenWithinKm,
  referenceLatitude,
  referenceLongitude,
}: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherState>({
    temp: 0,
    apparent: 0,
    code: 0,
    wind: 0,
    city: "موقعك الحالي",
    loading: true,
  });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let requestController: AbortController | null = null;

    const setError = (message: string) => {
      if (!cancelled) setWeather(current => ({ ...current, loading: false, error: message }));
    };

    const fetchAt = async (lat: number, lon: number, city: string) => {
      requestController?.abort();
      requestController = new AbortController();
      try {
        const next = await readWeather(lat, lon, requestController.signal);
        if (!cancelled) setWeather({ ...next, city });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError("تعذر جلب الطقس");
      }
    };

    const load = () => {
      const hasWorkLocation = latitude != null && longitude != null;
      const hasReference = hideWhenWithinKm != null
        && referenceLatitude != null
        && referenceLongitude != null;

      if (hasReference) {
        if (!navigator.geolocation) {
          setError("الموقع غير متاح");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          position => {
            if (cancelled) return;
            const inside = distanceKm(
              position.coords.latitude,
              position.coords.longitude,
              referenceLatitude,
              referenceLongitude,
            ) <= hideWhenWithinKm;
            setHidden(inside);
            if (!inside && hasWorkLocation) void fetchAt(latitude, longitude, "موقع العمل");
          },
          () => {
            if (cancelled) return;
            setHidden(false);
            if (hasWorkLocation) void fetchAt(latitude, longitude, "موقع العمل");
            else setError("فعّل الموقع لعرض الطقس");
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
        return;
      }

      setHidden(false);
      if (hasWorkLocation) {
        void fetchAt(latitude, longitude, "موقع العمل");
        return;
      }
      if (!navigator.geolocation) {
        setError("الموقع غير متاح");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => void fetchAt(position.coords.latitude, position.coords.longitude, "موقعك الحالي"),
        () => setError("فعّل الموقع لعرض الطقس"),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
    };

    load();
    const timer = window.setInterval(load, 600000);
    return () => {
      cancelled = true;
      requestController?.abort();
      window.clearInterval(timer);
    };
  }, [latitude, longitude, hideWhenWithinKm, referenceLatitude, referenceLongitude]);

  if (hidden) return null;

  const presentation = weatherPresentation(weather.code, new Date().getHours());
  const Icon = presentation.Icon;

  return (
    <section
      className={`hud-card weather-strip ${compact ? "p-2" : "p-3"} ${className}`}
      aria-label={title}
      title={title}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] text-muted-foreground truncate">{title}</div>
          <div className="font-black text-xs truncate">
            {weather.loading ? "جاري التحديث…" : weather.error || weather.city}
          </div>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      </div>
      {!weather.loading && !weather.error && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="mono text-lg font-black">{Math.round(weather.temp)}°C</div>
          <div className="text-[9px] text-muted-foreground text-left">
            {presentation.label} · {Math.round(weather.wind)} كم/س
          </div>
        </div>
      )}
    </section>
  );
}