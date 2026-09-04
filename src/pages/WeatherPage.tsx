import { useEffect, useMemo, useState } from "react";
import { Eye, Sunrise, Sunset } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";

type Tab = "rain" | "wind" | "humidity";
type Hour = { time: string; rain: number; wind: number; humidity: number; code: number };
type Weather = { temp:number; apparent:number; code:number; wind:number; humidity:number; uv:number; pressure:number; visibility:number; sunrise:string; sunset:string; timezone:string; city:string; isDay:boolean; hours:Hour[] };
const text=(c:number,day:boolean)=>c===0?(day?"صافي ومشمس":"صافي وسماء هادئة"):c<=2?(day?"غائم جزئيًا":"غائم جزئيًا ليلًا"):c===3?"غائم":c<=48?"ضباب":c<=67?"مطر":c<=77?"ثلوج":c<=82?"زخات مطر":c<=86?"زخات ثلج":"عاصفة رعدية";
const icon=(c:number,day:boolean)=>c===0?(day?"☀️":"🌙"):c<=2?(day?"🌤️":"🌙☁️"):c===3?"☁️":c<=48?"🌫️":c<=67?"🌧️":c<=77?"❄️":c<=82?"🌦️":c<=86?"🌨️":"⛈️";
const hour=(v:string,tz:string)=>{try{return new Intl.DateTimeFormat("ar",{hour:"numeric",minute:"2-digit",timeZone:tz}).format(new Date(v));}catch{return v.slice(11,16);}};
const reverseLocation=async(lat:number,lon:number,signal:AbortSignal)=>{try{const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),localityLanguage:"ar"});const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${q}`,{cache:"no-store",signal});if(!r.ok)throw Error("location");const d=await r.json();const name=String(d.city||d.locality||d.principalSubdivision||d.countryName||"").trim();return name||"موقعك الحالي";}catch{return "موقعك الحالي";}};
async function getWeather(lat:number,lon:number,signal:AbortSignal):Promise<Weather>{const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:"temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,pressure_msl,visibility,is_day",hourly:"precipitation_probability,wind_speed_10m,relative_humidity_2m,weather_code",daily:"sunrise,sunset",forecast_days:"2",timezone:"auto"});const r=await fetch(`https://api.open-meteo.com/v1/forecast?${q}`,{cache:"no-store",signal});if(!r.ok)throw Error("weather");const d=await r.json();const h:Hour[]=(d.hourly?.time??[]).slice(0,18).map((time:string,i:number)=>({time,rain:Number(d.hourly.precipitation_probability?.[i]??0),wind:Number(d.hourly.wind_speed_10m?.[i]??0),humidity:Number(d.hourly.relative_humidity_2m?.[i]??0),code:Number(d.hourly.weather_code?.[i]??0)}));const city=await reverseLocation(lat,lon,signal);return{temp:Number(d.current.temperature_2m),apparent:Number(d.current.apparent_temperature),code:Number(d.current.weather_code),wind:Number(d.current.wind_speed_10m),humidity:Number(d.current.relative_humidity_2m),uv:Number(d.current.uv_index??0),pressure:Number(d.current.pressure_msl??0),visibility:Number(d.current.visibility??0),sunrise:d.daily.sunrise[0],sunset:d.daily.sunset[0],timezone:d.timezone,city,isDay:Number(d.current.is_day)===1,hours:h};}

export default function WeatherPage(){
 const navigate=useNavigate();
 const session=currentSession();
 const[w,setW]=useState<Weather|null>(null);
 const[tab,setTab]=useState<Tab>("rain");
 const[error,setError]=useState("");
 const[refreshing,setRefreshing]=useState(false);
 const[locating,setLocating]=useState(false);
 useEffect(()=>{
   const root=document.documentElement;
   const body=document.body;
   const previousRootBackground=root.style.backgroundColor;
   const previousRootScheme=root.style.colorScheme;
   const syncThemeSurface=()=>{
     const background=getComputedStyle(body).backgroundColor;
     if(background) root.style.backgroundColor=background;
     root.style.colorScheme=root.classList.contains("dark")?"dark":"light";
   };
   syncThemeSurface();
   const observer=new MutationObserver(syncThemeSurface);
   observer.observe(root,{attributes:true,attributeFilter:["class"]});
   const media=window.matchMedia("(prefers-color-scheme: dark)");
   media.addEventListener?.("change",syncThemeSurface);
   return()=>{observer.disconnect();media.removeEventListener?.("change",syncThemeSurface);root.style.backgroundColor=previousRootBackground;root.style.colorScheme=previousRootScheme;};
 },[]);
 const refresh=async(lat:number,lon:number)=>{const c=new AbortController();setRefreshing(true);try{setW(await getWeather(lat,lon,c.signal));setError("");}catch{setError("تعذر تحديث بيانات الطقس. تحقق من الاتصال بالإنترنت.");}finally{setRefreshing(false);}};
 const locate=()=>{
   if(!navigator.geolocation){setError("الموقع الجغرافي غير متاح في هذا المتصفح.");return;}
   setLocating(true);setError("");
   navigator.geolocation.getCurrentPosition(
     p=>{setLocating(false);void refresh(p.coords.latitude,p.coords.longitude);},
     ()=>{navigator.geolocation.getCurrentPosition(p=>{setLocating(false);void refresh(p.coords.latitude,p.coords.longitude);},()=>{setLocating(false);setError("تعذر تحديد موقعك. اسمح للموقع من إعدادات المتصفح ثم اضغط «تحديد الموقع» مرة أخرى.");},{enableHighAccuracy:false,timeout:20000,maximumAge:0});},
     {enableHighAccuracy:true,timeout:12000,maximumAge:0},
   );
 };
 useEffect(()=>{let timer:number|undefined;const schedule=()=>{if(timer!==undefined)window.clearTimeout(timer);if(document.visibilityState!=="visible")return;timer=window.setTimeout(()=>{timer=undefined;locate();schedule();},600000);};const onVisibility=()=>{if(document.visibilityState==="visible"){locate();schedule();}else if(timer!==undefined){window.clearTimeout(timer);timer=undefined;}};locate();schedule();document.addEventListener("visibilitychange",onVisibility);return()=>{if(timer!==undefined)window.clearTimeout(timer);document.removeEventListener("visibilitychange",onVisibility);};},[]);
 const chart=useMemo(()=>w?.hours.slice(0,12)??[],[w]);
 const vals=chart.map(x=>tab==="rain"?x.rain:tab==="wind"?x.wind:x.humidity);
 const max=Math.max(1,...vals);
 return <main className="min-h-screen bg-background text-foreground px-3 py-4 sm:px-6" dir="rtl"><div className="mx-auto max-w-6xl"><div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={()=>navigate(-1)} className="rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm font-bold">→ العودة</button><button type="button" onClick={locate} disabled={locating||refreshing} className="rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm font-bold disabled:opacity-50">{locating?"جارٍ تحديد الموقع…":"⌖ تحديد الموقع"}</button><span className="text-xs text-muted-foreground">{refreshing?"جارٍ التحديث…":"تحديث حي كل 10 دقائق"}</span></div><section className="rounded-[28px] border border-border/80 bg-card p-5 text-card-foreground shadow-2xl sm:p-8"><header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/50 text-6xl">{w?icon(w.code,w.isDay):"🌍"}</div><div><p className="text-sm font-bold text-muted-foreground">الأحوال الجوية الحالية</p><h1 className="text-4xl font-black sm:text-5xl">{w?`${Math.round(w.temp)}°`:"—"}</h1><p className="font-bold">{w?text(w.code,w.isDay):"جاري تحديد حالة الجو"}</p><p className="text-sm font-bold text-muted-foreground">📍 {w?.city??"جاري تحديد موقعك…"}</p></div></div></header>{error&&<div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</div>}<div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">{[["💨","الرياح",w?`${Math.round(w.wind)} كم/س`:"—"],["💧","الرطوبة",w?`${Math.round(w.humidity)}%`:"—"],["☀️","مؤشر UV",w?String(Math.round(w.uv)):"—"],["⏱️","الضغط",w?`${Math.round(w.pressure)} hPa`:"—"],["🌡️","المحسوسة",w?`${Math.round(w.apparent)}°C`:"—"],["👁️","مدى الرؤية",w?`${(w.visibility/1000).toFixed(1)} كم`:"—"]].map(([i,t,v])=><div key={t} className="rounded-2xl border border-border/70 bg-secondary/20 p-4"><div className="text-xl">{i}</div><div className="mt-3 text-xs text-muted-foreground">{t}</div><div className="mt-1 text-sm font-black">{v}</div></div>)}</div><section className="mt-4 rounded-3xl border border-border/70 bg-secondary/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">الشروق والغروب</h2><p className="text-xs text-muted-foreground">مسار اليوم حسب موقعك</p></div><div className="flex gap-5 text-sm font-bold"><span className="flex items-center gap-2"><Sunrise className="h-5 w-5" aria-hidden="true"/> {w?hour(w.sunrise,w.timezone):"—"}</span><span className="flex items-center gap-2"><Sunset className="h-5 w-5" aria-hidden="true"/> {w?hour(w.sunset,w.timezone):"—"}</span></div></div><div className="relative mt-6 h-8 border-t border-dashed border-border"><Sunrise className="absolute left-0 -top-3 h-5 w-5" aria-hidden="true"/><span className="absolute left-1/2 -top-4 -translate-x-1/2 text-2xl">☀️</span><Sunset className="absolute right-0 -top-3 h-5 w-5" aria-hidden="true"/></div></section><section className="mt-4 rounded-3xl border border-border/70 bg-secondary/20 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">التفاصيل لكل ساعة</h2><p className="text-xs text-muted-foreground">{tab==="rain"?"احتمال الأمطار":tab==="wind"?"سرعة الرياح":"الرطوبة"} للساعات القادمة</p></div><div className="grid grid-cols-3 rounded-xl border border-border/70 p-1 text-xs font-bold">{(["rain","wind","humidity"] as Tab[]).map(x=><button key={x} type="button" onClick={()=>setTab(x)} className={`rounded-lg px-3 py-2 ${tab===x?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>{x==="rain"?"🌧️ الأمطار":x==="wind"?"💨 الرياح":"💧 الرطوبة"}</button>)}</div></div><div className="mt-5 overflow-x-auto pb-2"><div className="flex min-w-[720px] items-end gap-3">{chart.map((x,i)=>{const v=vals[i]??0;return <div key={x.time} className="flex w-12 shrink-0 flex-col items-center gap-2"><b className="text-[10px]">{Math.round(v)}{tab==="wind"?"":"%"}</b><div className="flex h-28 w-full items-end rounded-xl bg-secondary/40 p-1"><div className="w-full rounded-lg bg-primary/70" style={{height:`${Math.max(8,Math.round(v/max*100))}%`}}/></div><span className="text-[10px] text-muted-foreground">{hour(x.time,w?.timezone??"UTC")}</span><span className="text-lg">{icon(x.code,true)}</span></div>})}</div></div></section></section></div></main>;
}