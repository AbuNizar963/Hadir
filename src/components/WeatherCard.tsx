import { useEffect, useState } from "react";

type WeatherState = { temp: number; apparent: number; code: number; wind: number; city: string; loading: boolean; error?: string };
type WeatherCardProps = { compact?: boolean; latitude?: number; longitude?: number; title?: string; className?: string; hideWhenWithinKm?: number; referenceLatitude?: number; referenceLongitude?: number };
type OpenMeteoCurrent = { temperature_2m?: unknown; apparent_temperature?: unknown; weather_code?: unknown; wind_speed_10m?: unknown };

const labels = (code: number) => code === 0 ? "صافي" : code <= 3 ? "غائم جزئيًا" : code <= 48 ? "ضباب" : code <= 67 ? "أمطار" : code <= 77 ? "ثلوج" : code <= 82 ? "زخات مطر" : code <= 86 ? "زخات ثلج" : "عاصفة";
const icon = (code: number) => code === 0 ? "☀️" : code <= 3 ? "⛅" : code <= 48 ? "🌫️" : code <= 67 ? "🌧️" : code <= 77 ? "❄️" : code <= 82 ? "🌦️" : code <= 86 ? "🌨️" : "⛈️";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function distanceKm(a: number, b: number, c: number, d: number) {
  const radius = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(c - a);
  const longitudeDelta = radians(d - b);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(a)) * Math.cos(radians(c)) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function readWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<WeatherState> {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m", timezone: "auto" });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("weather");
  const payload = await response.json() as { current?: OpenMeteoCurrent };
  const current = payload.current;
  if (!current || !isFiniteNumber(current.temperature_2m) || !isFiniteNumber(current.apparent_temperature) || !isFiniteNumber(current.weather_code) || !isFiniteNumber(current.wind_speed_10m)) throw new Error("weather");
  return { temp: current.temperature_2m, apparent: current.apparent_temperature, code: current.weather_code, wind: current.wind_speed_10m, city: "الموقع", loading: false };
}

export default function WeatherCard({ compact = false, latitude, longitude, title = "الطقس", className = "", hideWhenWithinKm, referenceLatitude, referenceLongitude }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherState>({ temp: 0, apparent: 0, code: 0, wind: 0, city: "موقعك الحالي", loading: true });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let requestController: AbortController | null = null;
    const fetchAt = async (lat: number, lon: number, city: string) => {
      requestController?.abort();
      requestController = new AbortController();
      try {
        const next = await readWeather(lat, lon, requestController.signal);
        if (!cancelled) setWeather({ ...next, city });
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setWeather(current => ({ ...current, loading: false, error: "تعذر جلب الطقس" }));
      }
    };
    const load = () => {
      const useWorkLocation = latitude != null && longitude != null;
      const needsDevicePosition = hideWhenWithinKm != null && referenceLatitude != null && referenceLongitude != null;
      if (needsDevicePosition) {
        if (!navigator.geolocation) { if (!cancelled) setWeather(current => ({ ...current, loading: false, error: "الموقع غير متاح" })); return; }
        navigator.geolocation.getCurrentPosition(position => {
          if (cancelled) return;
          const inside = distanceKm(position.coords.latitude, position.coords.longitude, referenceLatitude, referenceLongitude) <= hideWhenWithinKm;
          setHidden(inside);
          if (!inside && useWorkLocation) void fetchAt(latitude, longitude, "موقع العمل");
        }, () => { if (!cancelled) { setHidden(false); if (useWorkLocation) void fetchAt(latitude, longitude, "موقع العمل"); } }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
        return;
      }
      setHidden(false);
      if (useWorkLocation) { void fetchAt(latitude, longitude, "موقع العمل"); return; }
      if (!navigator.geolocation) { setWeather(current => ({ ...current, loading: false, error: "الموقع غير متاح" })); return; }
      navigator.geolocation.getCurrentPosition(position => void fetchAt(position.coords.latitude, position.coords.longitude, "موقعك الحالي"), () => { if (!cancelled) setWeather(current => ({ ...current, loading: false, error: "فعّل الموقع لعرض الطقس" })); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    };
    load();
    const timer = window.setInterval(load, 600000);
    return () => { cancelled = true; requestController?.abort(); window.clearInterval(timer); };
  }, [latitude, longitude, hideWhenWithinKm, referenceLatitude, referenceLongitude]);

  if (hidden) return null;
  return <section className={`hud-card weather-strip ${compact ? "p-2" : "p-3"} ${className}`} aria-label={title} title={title} aria-live="polite">
    <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-[9px] text-muted-foreground truncate">{title}</div><div className="font-black text-xs truncate">{weather.loading ? "جاري التحديث…" : weather.error || weather.city}</div></div><div className="text-xl shrink-0" aria-hidden="true">{weather.loading ? "🌍" : icon(weather.code)}</div></div>
    {!weather.loading && !weather.error && <div className="mt-1 flex items-center justify-between gap-2"><div className="mono text-lg font-black">{Math.round(weather.temp)}°C</div><div className="text-[9px] text-muted-foreground text-left">{labels(weather.code)} · {Math.round(weather.wind)} كم/س</div></div>}
  </section>;
}