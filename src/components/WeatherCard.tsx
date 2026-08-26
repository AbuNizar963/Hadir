import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  Moon,
  Navigation,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Umbrella,
  Wind,
} from "lucide-react";

type HourlyPoint = {
  time: string;
  temp: number;
  code: number;
  precipitationProbability: number;
};

type DailyPoint = {
  date: string;
  min: number;
  max: number;
  code: number;
  precipitationProbability: number;
};

type WeatherState = {
  temp: number;
  apparent: number;
  code: number;
  wind: number;
  windGust: number;
  humidity: number;
  precipitation: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  city: string;
  country: string;
  timezone: string;
  isDay: boolean;
  sunrise?: string;
  sunset?: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  loading: boolean;
  error?: string;
  updatedAt?: number;
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
  wind_gusts_10m?: unknown;
  relative_humidity_2m?: unknown;
  precipitation?: unknown;
  surface_pressure?: unknown;
  visibility?: unknown;
  uv_index?: unknown;
  is_day?: unknown;
};

type OpenMeteoPayload = {
  current?: OpenMeteoCurrent;
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    weather_code?: unknown;
    precipitation_probability?: unknown;
  };
  daily?: {
    time?: unknown;
    temperature_2m_min?: unknown;
    temperature_2m_max?: unknown;
    weather_code?: unknown;
    precipitation_probability_max?: unknown;
    sunrise?: unknown;
    sunset?: unknown;
  };
  timezone?: unknown;
};

type ReverseGeocodePayload = {
  city?: unknown;
  locality?: unknown;
  principalSubdivision?: unknown;
  countryName?: unknown;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const numberAt = (values: unknown, index: number, fallback = 0) => {
  if (!Array.isArray(values)) return fallback;
  const value = values[index];
  return isFiniteNumber(value) ? value : fallback;
};

const stringAt = (values: unknown, index: number, fallback = "") => {
  if (!Array.isArray(values)) return fallback;
  const value = values[index];
  return typeof value === "string" ? value : fallback;
};

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

function timezoneLabel(timezone: string) {
  const last = timezone.split("/").pop()?.replace(/_/g, " ") || "الموقع";
  return last === "Istanbul" ? "إسطنبول" : last;
}

function weatherPresentation(code: number, isDay: boolean) {
  const normalized = normalizeWeatherCode(code);
  if (normalized === 0) return { label: isDay ? "صافي" : "صافي ليلاً", Icon: isDay ? Sun : Moon };
  if (normalized <= 3) return { label: isDay ? "غائم جزئيًا" : "غائم جزئيًا ليلاً", Icon: isDay ? CloudSun : Cloud };
  if (normalized <= 48) return { label: "ضباب", Icon: CloudFog };
  if (normalized <= 57) return { label: "رذاذ", Icon: CloudRain };
  if (normalized <= 67) return { label: "أمطار", Icon: CloudRain };
  if (normalized <= 77) return { label: "ثلوج", Icon: Snowflake };
  if (normalized <= 82) return { label: "زخات مطر", Icon: CloudRain };
  if (normalized <= 86) return { label: "زخات ثلج", Icon: Snowflake };
  return { label: "عاصفة رعدية", Icon: CloudLightning };
}

function formatHour(value: string) {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] || value.slice(-5);
}

function formatDay(value: string, index: number) {
  if (index === 0) return "اليوم";
  if (index === 1) return "غدًا";
  try {
    return new Intl.DateTimeFormat("ar", { weekday: "short" }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

async function reverseGeocode(latitude: number, longitude: number, signal: AbortSignal) {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "ar",
  });
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`geocode:${response.status}`);
  return response.json() as Promise<ReverseGeocodePayload>;
}

async function readWeather(latitude: number, longitude: number, signal: AbortSignal, resolveCurrentLocation: boolean): Promise<WeatherState> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,precipitation,surface_pressure,visibility,uv_index,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max,sunrise,sunset",
    forecast_days: "5",
    timezone: "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`weather:${response.status}`);

  const payload = await response.json() as OpenMeteoPayload;
  const current = payload.current;
  if (!current
    || !isFiniteNumber(current.temperature_2m)
    || !isFiniteNumber(current.apparent_temperature)
    || !isFiniteNumber(current.weather_code)
    || !isFiniteNumber(current.wind_speed_10m)) {
    throw new Error("weather:invalid-response");
  }

  const timezone = typeof payload.timezone === "string" ? payload.timezone : "";
  const hourlyTimes = Array.isArray(payload.hourly?.time) ? payload.hourly?.time : [];
  const hourly = hourlyTimes.slice(0, 8).map((time, index) => ({
    time: String(time),
    temp: numberAt(payload.hourly?.temperature_2m, index, current.temperature_2m),
    code: normalizeWeatherCode(numberAt(payload.hourly?.weather_code, index, current.weather_code)),
    precipitationProbability: Math.round(Math.max(0, Math.min(100, numberAt(payload.hourly?.precipitation_probability, index)))),
  }));

  const dailyTimes = Array.isArray(payload.daily?.time) ? payload.daily?.time : [];
  const daily = dailyTimes.slice(0, 5).map((date, index) => ({
    date: String(date),
    min: numberAt(payload.daily?.temperature_2m_min, index, current.temperature_2m),
    max: numberAt(payload.daily?.temperature_2m_max, index, current.temperature_2m),
    code: normalizeWeatherCode(numberAt(payload.daily?.weather_code, index, current.weather_code)),
    precipitationProbability: Math.round(Math.max(0, Math.min(100, numberAt(payload.daily?.precipitation_probability_max, index)))),
  }));

  let city = resolveCurrentLocation ? "موقعك الحالي" : "موقع العمل";
  let country = "";
  if (resolveCurrentLocation) {
    try {
      const location = await reverseGeocode(latitude, longitude, signal);
      city = typeof location.city === "string" && location.city.trim()
        ? location.city
        : typeof location.locality === "string" && location.locality.trim()
          ? location.locality
          : typeof location.principalSubdivision === "string" && location.principalSubdivision.trim()
            ? location.principalSubdivision
            : city;
      country = typeof location.countryName === "string" ? location.countryName : "";
    } catch {
      // Weather remains usable even when reverse geocoding is unavailable.
    }
  } else if (timezone) {
    city = `${city} · ${timezoneLabel(timezone)}`;
  }

  return {
    temp: current.temperature_2m,
    apparent: current.apparent_temperature,
    code: normalizeWeatherCode(current.weather_code),
    wind: Math.max(0, current.wind_speed_10m),
    windGust: Math.max(0, isFiniteNumber(current.wind_gusts_10m) ? current.wind_gusts_10m : current.wind_speed_10m),
    humidity: Math.round(Math.max(0, Math.min(100, isFiniteNumber(current.relative_humidity_2m) ? current.relative_humidity_2m : 0))),
    precipitation: Math.max(0, isFiniteNumber(current.precipitation) ? current.precipitation : 0),
    pressure: Math.max(0, isFiniteNumber(current.surface_pressure) ? current.surface_pressure : 0),
    visibility: Math.max(0, isFiniteNumber(current.visibility) ? current.visibility / 1000 : 0),
    uvIndex: Math.max(0, isFiniteNumber(current.uv_index) ? current.uv_index : 0),
    city,
    country,
    timezone,
    isDay: current.is_day === 1,
    sunrise: stringAt(payload.daily?.sunrise, 0),
    sunset: stringAt(payload.daily?.sunset, 0),
    hourly,
    daily,
    loading: false,
    updatedAt: Date.now(),
  };
}

const initialWeather: WeatherState = {
  temp: 0,
  apparent: 0,
  code: 0,
  wind: 0,
  windGust: 0,
  humidity: 0,
  precipitation: 0,
  pressure: 0,
  visibility: 0,
  uvIndex: 0,
  city: "موقعك الحالي",
  country: "",
  timezone: "",
  isDay: true,
  hourly: [],
  daily: [],
  loading: true,
};

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
  const [weather, setWeather] = useState<WeatherState>(initialWeather);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let requestController: AbortController | null = null;

    const setError = (message: string) => {
      if (!cancelled) setWeather(current => ({ ...current, loading: false, error: message }));
    };

    const fetchAt = async (lat: number, lon: number, resolveCurrentLocation: boolean) => {
      requestController?.abort();
      requestController = new AbortController();
      try {
        const next = await readWeather(lat, lon, requestController.signal, resolveCurrentLocation);
        if (!cancelled) setWeather(next);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError("تعذر جلب الطقس");
      }
    };

    const loadCurrent = () => {
      if (!navigator.geolocation) {
        setError("الموقع غير متاح");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => {
          if (cancelled) return;
          void fetchAt(position.coords.latitude, position.coords.longitude, true);
        },
        () => setError("فعّل الموقع لعرض الطقس"),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
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
            if (!inside && hasWorkLocation) void fetchAt(latitude, longitude, false);
          },
          () => {
            if (cancelled) return;
            setHidden(false);
            if (hasWorkLocation) void fetchAt(latitude, longitude, false);
            else setError("فعّل الموقع لعرض الطقس");
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
        return;
      }

      setHidden(false);
      if (hasWorkLocation) {
        void fetchAt(latitude, longitude, false);
        return;
      }
      loadCurrent();
    };

    load();
    const timer = window.setInterval(load, 600000);
    return () => {
      cancelled = true;
      requestController?.abort();
      window.clearInterval(timer);
    };
  }, [latitude, longitude, hideWhenWithinKm, referenceLatitude, referenceLongitude]);

  const presentation = useMemo(
    () => weatherPresentation(weather.code, weather.isDay),
    [weather.code, weather.isDay],
  );
  const Icon = presentation.Icon;

  if (hidden) return null;

  const metric = (value: string, label: string, MetricIcon: typeof Wind) => (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-secondary/35 px-2.5 py-2">
      <MetricIcon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0">
        <div className="truncate text-[10px] text-muted-foreground">{label}</div>
        <div className="mono truncate text-xs font-bold">{value}</div>
      </div>
    </div>
  );

  return (
    <section
      className={`hud-card weather-strip overflow-hidden ${compact ? "p-2.5" : "p-3.5"} ${className}`}
      aria-label={title}
      title={title}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{weather.loading ? "تحديد الموقع…" : weather.error || weather.city}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{title}</div>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
        </div>
      </div>

      {weather.loading ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-secondary/70" />
          <div className="h-5 w-28 animate-pulse rounded-lg bg-secondary/60" />
        </div>
      ) : weather.error ? (
        <div className="mt-3 text-xs text-destructive">{weather.error}</div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-end gap-1">
                <span className="mono text-3xl font-black leading-none tracking-tight">{Math.round(weather.temp)}°</span>
                <span className="pb-0.5 text-xs text-muted-foreground">C</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold">{presentation.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">المحسوسة {Math.round(weather.apparent)}°</div>
            </div>
            <div className="text-left text-[10px] text-muted-foreground">
              <div className="flex items-center justify-end gap-1"><Wind className="h-3.5 w-3.5" />{Math.round(weather.wind)} كم/س</div>
              <div className="mt-1 flex items-center justify-end gap-1"><Droplets className="h-3.5 w-3.5" />رطوبة {weather.humidity}%</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metric(`${weather.humidity}%`, "الرطوبة", Droplets)}
            {metric(`${Math.round(weather.wind)} كم/س`, "الرياح", Wind)}
            {metric(`${weather.uvIndex.toFixed(1)}`, "مؤشر UV", Sun)}
            {metric(`${weather.visibility.toFixed(1)} كم`, "الرؤية", Eye)}
          </div>

          {!compact && weather.daily.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold text-muted-foreground">التوقعات القادمة</div>
                <button type="button" onClick={() => setExpanded(value => !value)} className="text-[10px] font-bold text-primary hover:underline">
                  {expanded ? "إخفاء التفاصيل" : "تفاصيل أكثر"}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {weather.daily.map((day, index) => {
                  const DayIcon = weatherPresentation(day.code, true).Icon;
                  return (
                    <div key={day.date} className="min-w-0 rounded-xl border border-border/50 bg-secondary/25 px-1.5 py-2 text-center">
                      <div className="truncate text-[9px] font-semibold text-muted-foreground">{formatDay(day.date, index)}</div>
                      <DayIcon className="mx-auto my-1 h-4 w-4 text-primary" strokeWidth={1.7} aria-hidden="true" />
                      <div className="mono text-[10px] font-bold">{Math.round(day.max)}° / {Math.round(day.min)}°</div>
                      {day.precipitationProbability > 0 && <div className="mt-0.5 text-[8px] text-muted-foreground">💧 {day.precipitationProbability}%</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {metric(`${weather.pressure.toFixed(0)} hPa`, "الضغط", Gauge)}
                {metric(`${weather.windGust.toFixed(0)} كم/س`, "هبات الرياح", Navigation)}
                {metric(`${weather.precipitation.toFixed(1)} مم`, "الهطول الآن", Umbrella)}
                {metric(`${weather.uvIndex.toFixed(1)}`, "UV الآن", Sun)}
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 text-[10px]">
                <div className="flex items-center gap-1.5"><Sunrise className="h-4 w-4 text-primary" />الشروق {formatHour(weather.sunrise || "—")}</div>
                <div className="flex items-center gap-1.5"><Sunset className="h-4 w-4 text-primary" />الغروب {formatHour(weather.sunset || "—")}</div>
              </div>
              {weather.hourly.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-2 pb-1">
                    {weather.hourly.map((hour, index) => {
                      const HourIcon = weatherPresentation(hour.code, true).Icon;
                      return (
                        <div key={`${hour.time}-${index}`} className="w-16 rounded-xl border border-border/50 bg-secondary/25 p-2 text-center">
                          <div className="text-[9px] text-muted-foreground">{index === 0 ? "الآن" : formatHour(hour.time)}</div>
                          <HourIcon className="mx-auto my-1 h-4 w-4 text-primary" strokeWidth={1.7} aria-hidden="true" />
                          <div className="mono text-[10px] font-bold">{Math.round(hour.temp)}°</div>
                          {hour.precipitationProbability > 0 && <div className="mt-0.5 text-[8px] text-muted-foreground">{hour.precipitationProbability}%</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
            <span>{weather.country || (weather.timezone ? timezoneLabel(weather.timezone) : "الموقع الحالي")}</span>
            <span>{weather.updatedAt ? `تحديث ${new Date(weather.updatedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
          </div>
        </>
      )}
    </section>
  );
}
