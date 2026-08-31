import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CloudSun, MapPin, Moon, RefreshCw, Share2, Sun, Sunrise, Sunset } from "lucide-react";
import { getPrayerTimes, getQiblaBearingFromProvider, qiblaBearing, distanceToKaabaKm, bearingLabel, type PrayerResponse } from "@/lib/prayerTimes";

type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
type OrientationWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationConstructor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied" | "default"> };
type OrientationSource = "apple" | "absolute" | "relative";
type PrayerItem = { key: PrayerKey; name: string; icon: typeof Moon };

const PRAYERS: PrayerItem[] = [
  { key: "fajr", name: "الفجر", icon: Moon },
  { key: "sunrise", name: "الشروق", icon: Sunrise },
  { key: "dhuhr", name: "الظهر", icon: Sun },
  { key: "asr", name: "العصر", icon: CloudSun },
  { key: "maghrib", name: "المغرب", icon: Sunset },
  { key: "isha", name: "العشاء", icon: Moon },
];

const normalize = (value: number) => (value % 360 + 360) % 360;
const shortestDelta = (target: number, current: number) => ((target - current + 540) % 360) - 180;
const toMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : Number.NaN;
};
const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? "ليل سعيد" : hour < 12 ? "صباح الخير" : hour < 18 ? "نهار سعيد" : "مساء الخير";
};

function hasIOSPermissionApi() {
  if (typeof window === "undefined") return false;
  const ctor = window.DeviceOrientationEvent as unknown as OrientationConstructor;
  return typeof ctor.requestPermission === "function";
}

export default function PrayerPage() {
  const navigate = useNavigate();
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [data, setData] = useState<PrayerResponse | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState(0);
  const [city, setCity] = useState("موقعك الحالي");
  const [sensorEnabled, setSensorEnabled] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [sensorMessage, setSensorMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const rawHeadingRef = useRef(0);
  const targetHeadingRef = useRef(0);
  const smoothHeadingRef = useRef(0);
  const initializedRef = useRef(false);
  const sourceRef = useRef<OrientationSource | null>(null);
  const lastAbsoluteAtRef = useRef(0);
  const lastSensorAtRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setError("الموقع غير متاح على هذا الجهاز"); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { latitude, longitude } = p.coords;
      setPosition(p);
      setBearing(qiblaBearing(latitude, longitude));
      let locationName = "موقعك الحالي";
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`, { cache: "no-store" });
        if (response.ok) {
          const geo = await response.json() as { city?: string; locality?: string; principalSubdivision?: string };
          locationName = geo.city || geo.locality || geo.principalSubdivision || locationName;
        }
      } catch { /* اسم المدينة اختياري. */ }
      setCity(locationName);
      try { setData(await getPrayerTimes({ latitude, longitude, city: locationName })); }
      catch { setError("تعذر جلب مواقيت الصلاة للموقع الحالي"); }
      try { setBearing(await getQiblaBearingFromProvider(latitude, longitude)); }
      catch { /* نستخدم الحساب المحلي المجاني كبديل. */ }
    }, () => setError("اسمح بالوصول إلى الموقع لعرض المواقيت والقبلة"), { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }, []);

  useEffect(() => { locate(); }, [locate]);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);

  const readOrientation = useCallback((event: DeviceOrientationEvent) => {
    const e = event as OrientationWithCompass;
    const timestamp = Date.now();
    let next: number | null = null;
    let source: OrientationSource | null = null;

    if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) {
      next = normalize(e.webkitCompassHeading);
      source = "apple";
    } else if ((event as DeviceOrientationEvent & { absolute?: boolean }).absolute === true) {
      if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
        const screenAngle = window.screen.orientation?.angle ?? 0;
        next = normalize(360 - event.alpha + screenAngle);
        source = "absolute";
        lastAbsoluteAtRef.current = timestamp;
      }
    } else if (sourceRef.current !== "absolute" && timestamp - lastAbsoluteAtRef.current > 1500) {
      if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
        const screenAngle = window.screen.orientation?.angle ?? 0;
        next = normalize(360 - event.alpha + screenAngle);
        source = "relative";
      }
    }

    if (next == null || source == null) return;
    if (sourceRef.current === "absolute" && source === "relative") return;
    rawHeadingRef.current = next;
    sourceRef.current = source;
    lastSensorAtRef.current = timestamp;

    if (!initializedRef.current) {
      initializedRef.current = true;
      targetHeadingRef.current = next;
      smoothHeadingRef.current = next;
      setHeading(next);
    }
    setSensorEnabled(true);
    setPermissionNeeded(false);
    setSensorMessage("");
  }, []);

  const enableCompass = useCallback(async () => {
    if (!window.isSecureContext) { setSensorMessage("البوصلة الحية تحتاج إلى HTTPS أو localhost."); return; }
    if (!("DeviceOrientationEvent" in window)) { setSensorMessage("هذا المتصفح لا يدعم حساس الاتجاه."); return; }
    try {
      const ctor = window.DeviceOrientationEvent as unknown as OrientationConstructor;
      if (ctor.requestPermission) {
        const permission = await ctor.requestPermission();
        if (permission !== "granted") {
          setPermissionNeeded(true);
          setSensorMessage("تم رفض إذن حساس الاتجاه. اسمح بالحركة والاتجاه من إعدادات الجهاز.");
          return;
        }
      }
      window.removeEventListener("deviceorientationabsolute", readOrientation, true);
      window.removeEventListener("deviceorientation", readOrientation, true);
      window.addEventListener("deviceorientationabsolute", readOrientation, true);
      window.addEventListener("deviceorientation", readOrientation, true);
      setPermissionNeeded(false);
      setSensorMessage("حرّك الهاتف ببطء؛ السهم الأحمر يتجه مباشرة نحو القبلة.");
    } catch { setSensorMessage("تعذر الوصول إلى حساس الاتجاه. تأكد من HTTPS ودعم المتصفح."); }
  }, [readOrientation]);

  const resetCompass = useCallback(() => {
    rawHeadingRef.current = 0;
    targetHeadingRef.current = 0;
    smoothHeadingRef.current = 0;
    initializedRef.current = false;
    sourceRef.current = null;
    lastAbsoluteAtRef.current = 0;
    lastSensorAtRef.current = 0;
    setHeading(0);
    setSensorEnabled(false);
    setSensorMessage("");
    if (!window.isSecureContext) { setSensorMessage("البوصلة الحية تحتاج إلى HTTPS أو localhost."); return; }
    if (hasIOSPermissionApi()) setPermissionNeeded(true); else void enableCompass();
  }, [enableCompass]);

  useEffect(() => {
    if (!window.isSecureContext) { setSensorMessage("البوصلة الحية تحتاج إلى HTTPS أو localhost."); return; }
    if (hasIOSPermissionApi()) { setPermissionNeeded(true); return; }
    void enableCompass();
    return () => {
      window.removeEventListener("deviceorientationabsolute", readOrientation, true);
      window.removeEventListener("deviceorientation", readOrientation, true);
    };
  }, [enableCompass, readOrientation]);

  useEffect(() => {
    const tick = () => {
      const targetDelta = shortestDelta(rawHeadingRef.current, targetHeadingRef.current);
      targetHeadingRef.current = normalize(targetHeadingRef.current + targetDelta * 0.12);
      const smoothDelta = shortestDelta(targetHeadingRef.current, smoothHeadingRef.current);
      smoothHeadingRef.current = normalize(smoothHeadingRef.current + smoothDelta * 0.16);
      if (initializedRef.current) setHeading(smoothHeadingRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (sensorEnabled && Date.now() - lastSensorAtRef.current > 3000) {
        setSensorEnabled(false);
        setSensorMessage("لم تصل بيانات الحساس. حرّك الهاتف ببطء أو أعد تفعيل البوصلة.");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sensorEnabled]);

  const nextPrayer = useMemo(() => {
    if (!data) return null;
    const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const list = PRAYERS.map(prayer => ({ prayer, minutes: toMinutes(data.times[prayer.key]) })).filter(item => Number.isFinite(item.minutes));
    return list.find(item => item.minutes > current) || (list[0] ? { prayer: list[0].prayer, minutes: list[0].minutes + 1440 } : null);
  }, [data, now]);

  const timer = useMemo(() => {
    if (!nextPrayer) return "--:--:--";
    const target = new Date(now);
    target.setHours(Math.floor(nextPrayer.minutes / 60), nextPrayer.minutes % 60, 0, 0);
    if (nextPrayer.minutes >= 1440) target.setDate(target.getDate() + 1);
    return countdown(target.getTime() - now.getTime());
  }, [nextPrayer, now]);

  const distance = position ? distanceToKaabaKm(position.coords.latitude, position.coords.longitude) : null;
  const needleRotation = bearing == null ? 0 : shortestDelta(bearing, heading);
  const aligned = bearing != null && Math.abs(shortestDelta(bearing, heading)) <= 5;
  const share = async () => {
    const text = `اتجاه القبلة من ${city}: ${bearing == null ? "--" : `${Math.round(bearing)}°`} • المسافة إلى مكة: ${distance == null ? "--" : `${distance.toFixed(1)} كم`}`;
    try {
      if (navigator.share) await navigator.share({ title: "اتجاه القبلة", text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else setSensorMessage(text);
    } catch { /* إلغاء المشاركة ليس خطأ. */ }
  };

  return <main dir="rtl" className="min-h-screen bg-[#06101c] p-3 text-white sm:p-6"><div className="mx-auto max-w-5xl space-y-4">
    <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"><ArrowRight className="h-4 w-4" />العودة</button>
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0d2743] via-[#08192b] to-[#040b14] shadow-2xl"><div className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-sm text-emerald-200/80">{greeting()} 👋</div><h1 className="mt-1 text-2xl font-black sm:text-3xl">الصلاة القادمة: {nextPrayer?.prayer.name || "—"}</h1><p className="mt-1 text-sm text-slate-300"><MapPin className="mr-1 inline h-4 w-4" />{city} • {data?.meta.gregorian || "جارٍ تحديد التاريخ"}{data?.meta.hijri && ` • ${data.meta.hijri}`}</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-center"><div className="text-xs text-emerald-100/70">المتبقي</div><div className="font-mono text-3xl font-black tracking-wider text-emerald-100">{timer}</div></div></div>
      {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="rounded-3xl border border-white/10 bg-black/10 p-5"><div className="mb-4 flex items-center justify-between"><div className="font-black">بوصلة القبلة</div><div className={`rounded-full px-3 py-1 text-xs ${sensorEnabled ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>{sensorEnabled ? "● حساس مباشر" : "○ بانتظار الحساس"}</div></div>
          <div className="relative mx-auto mt-3 aspect-square w-full max-w-[360px]"><div className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full text-center"><div className="text-3xl drop-shadow-[0_0_12px_rgba(248,113,113,.75)]">🕋</div><div className="mt-1 rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200">القبلة • {bearing == null ? "--" : `${Math.round(bearing)}°`}</div></div>
            <div className="absolute inset-0 rounded-full border-[8px] border-emerald-400/45 bg-[radial-gradient(circle_at_center,#102f4d_0,#07182a_55%,#020a12_100%)] shadow-[inset_0_0_55px_rgba(0,0,0,.8),0_0_40px_rgba(52,211,153,.14)]"><div className="absolute inset-4 rounded-full border border-emerald-300/20" /><div className="absolute inset-8 rounded-full border border-dashed border-emerald-300/10" /><div className="absolute inset-0">{Array.from({ length: 72 }, (_, i) => <span key={i} className="absolute left-1/2 top-1/2 block origin-bottom bg-slate-300/35" style={{ height: i % 3 === 0 ? "8%" : "4%", width: i % 3 === 0 ? 2 : 1, transform: `translate(-50%,-100%) rotate(${i * 5}deg)` }} />)}<span className="absolute inset-x-0 top-7 text-center text-sm font-black text-white">شمال</span><span className="absolute inset-x-0 bottom-7 text-center text-sm text-slate-400">جنوب</span><span className="absolute right-7 top-1/2 -translate-y-1/2 text-sm text-slate-400">شرق</span><span className="absolute left-7 top-1/2 -translate-y-1/2 text-sm text-slate-400">غرب</span></div><div className="absolute inset-0 flex items-center justify-center"><div className="absolute h-[43%] w-2 origin-bottom rounded-full bg-gradient-to-t from-red-600 via-red-400 to-red-200 shadow-[0_0_18px_rgba(248,113,113,.9)]" style={{ transform: `translateY(-50%) rotate(${needleRotation}deg)`, willChange: "transform" }}><span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 -translate-y-full border-x-[9px] border-b-[18px] border-x-transparent border-b-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,.9)]" /></div><div className="absolute h-10 w-10 rounded-full border border-white/15 bg-[#071a2c] shadow-xl" /></div></div></div>
          <div className="mt-5 text-center"><div className="font-mono text-3xl font-black text-red-300">{bearing == null ? "--" : `${Math.round(bearing)}°`}</div><div className="mt-1 text-sm text-slate-300">{aligned ? "أنت تواجه القبلة ✓" : bearing == null ? "جارٍ تحديد الاتجاه" : `${bearingLabel(bearing)} نحو مكة`}</div><div className="mt-2 text-xs text-slate-500">اتجاه الجهاز {Math.round(heading)}° • المسافة {distance == null ? "--" : `${distance.toFixed(1)} كم`}</div></div>
          <div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={share} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"><Share2 className="h-4 w-4" />مشاركة اتجاه مدينتي</button><button onClick={locate} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4" />إعادة تحديد الموقع</button>{permissionNeeded && <button onClick={() => void enableCompass()} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-100">تفعيل البوصلة الحية</button>}<button onClick={resetCompass} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">إعادة ضبط</button></div>{sensorMessage && <p className="mt-3 text-center text-xs text-amber-200">{sensorMessage}</p>}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-black">مواقيت الصلاة</h2><span className="text-xs text-slate-400">رابطة العالم الإسلامي</span></div><div className="space-y-2">{PRAYERS.map(prayer => { const active = nextPrayer?.prayer.key === prayer.key; const Icon = prayer.icon; return <div key={prayer.key} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${active ? "bg-emerald-400/15 ring-1 ring-emerald-300/30" : "bg-white/[.03]"}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className={active ? "font-black text-emerald-200" : "text-slate-200"}>{prayer.name}</span></div><span className="font-mono text-lg font-black">{data?.times[prayer.key] || "--:--"}</span></div>; })}</div><div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300">يتم حساب المواقيت حسب موقعك وبطريقة <b className="text-white">Muslim World League</b>.</div></div>
      </div>
    </div></section>
  </div></main>;
}
