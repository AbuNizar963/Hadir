import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Compass, LocateFixed, Navigation, RotateCcw } from "lucide-react";
import { getPrayerTimes, qiblaBearing, bearingLabel, type PrayerTimes } from "@/lib/prayerTimes";

export default function PrayerPage(){
 const navigate=useNavigate();
 const [pos,setPos]=useState<GeolocationPosition|null>(null);
 const [times,setTimes]=useState<PrayerTimes|null>(null);
 const [bearing,setBearing]=useState<number|null>(null);
 const [heading,setHeading]=useState<number|null>(null);
 const [sensorEnabled,setSensorEnabled]=useState(false);
 const [sensorAvailable,setSensorAvailable]=useState(false);
 const [error,setError]=useState("");

 useEffect(()=>{
  if(!navigator.geolocation){setError("الموقع غير متاح على هذا الجهاز");return;}
  navigator.geolocation.getCurrentPosition(p=>{
   setPos(p);
   setBearing(qiblaBearing(p.coords.latitude,p.coords.longitude));
   getPrayerTimes({latitude:p.coords.latitude,longitude:p.coords.longitude}).then(setTimes).catch(()=>setError("تعذر جلب مواقيت الصلاة"));
  },()=>setError("اسمح بالوصول إلى الموقع لعرض المواقيت واتجاه القبلة"),{enableHighAccuracy:true,timeout:10000});
 },[]);

 const readOrientation=(event: DeviceOrientationEvent)=>{
  let h:number|undefined;
  const e=event as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if(typeof e.webkitCompassHeading === "number") h=e.webkitCompassHeading;
  else if(typeof event.alpha === "number") h=(360-event.alpha)%360;
  if(h!=null){setHeading((h+360)%360);setSensorAvailable(true);}
 };

 const enableCompass=async()=>{
  const permission=(DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?:()=>Promise<string> }).requestPermission;
  if(permission){
   try{const result=await permission(); if(result!=="granted") return;}catch{return;}
  }
  window.addEventListener("deviceorientation",readOrientation,true);
  setSensorEnabled(true);
 };

 useEffect(()=>()=>window.removeEventListener("deviceorientation",readOrientation,true),[]);

 const cards=[['الفجر',times?.fajr,'🌙'],['الشروق',times?.sunrise,'🌅'],['الظهر',times?.dhuhr,'☀️'],['العصر',times?.asr,'🌤️'],['المغرب',times?.maghrib,'🌇'],['العشاء',times?.isha,'🌙']];
 const target=bearing ?? 0;
 const relative=heading==null ? target : (target-heading+360)%360;
 const accuracyText=sensorEnabled&&sensorAvailable?'بوصلة الجهاز تعمل مباشرة':'اضغط تفعيل البوصلة لتحريك المؤشر مع هاتفك';
 return <main dir="rtl" className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5"><button onClick={()=>navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold"><ArrowRight className="h-4 w-4"/>العودة</button><section className="rounded-3xl border border-border bg-card p-6 shadow-xl"><div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl">🕌</div><div><h1 className="text-2xl font-black">مواقيت الصلاة والقبلة</h1><p className="text-sm text-muted-foreground">حسب موقعك الحالي • بوصلة حية عند دعم الجهاز</p></div></div>{error?<div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}</div>:<><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{cards.map(([name,time,icon])=><div key={name} className="rounded-2xl border border-border bg-secondary/40 p-4 text-center"><div className="text-2xl">{icon}</div><div className="mt-2 text-xs text-muted-foreground">{name}</div><div className="mt-1 text-xl font-black mono">{time||'--:--'}</div></div>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-border bg-secondary/30 p-5"><div className="flex items-center gap-2 font-black"><Compass className="h-5 w-5 text-primary"/>اتجاه القبلة</div><div className="mt-4 flex flex-col items-center gap-4"><div className="relative grid h-56 w-56 place-items-center rounded-full border-4 border-primary/20 bg-background shadow-inner"><div className="absolute inset-2 rounded-full border border-border/70"/><div className="absolute inset-0 text-center text-xs font-bold text-muted-foreground"><span className="absolute left-1/2 top-2 -translate-x-1/2">شمال</span><span className="absolute bottom-2 left-1/2 -translate-x-1/2">جنوب</span><span className="absolute right-2 top-1/2 -translate-y-1/2">شرق</span><span className="absolute left-2 top-1/2 -translate-y-1/2">غرب</span></div><div className="absolute h-[92px] w-1 origin-bottom rounded-full bg-primary shadow-lg transition-transform duration-150 ease-out" style={{transform:`translateY(-50%) rotate(${relative}deg)`}}/><div className="relative z-10 grid h-14 w-14 place-items-center rounded-full border-2 border-primary/30 bg-card text-2xl shadow-lg">🕋</div></div><div className="text-center"><div className="text-3xl font-black mono">{bearing==null?'--':`${Math.round(bearing)}°`}</div><div className="text-sm text-muted-foreground">{bearing==null?'جارٍ تحديد الاتجاه':`${bearingLabel(bearing)} نحو مكة`}</div><div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Navigation className="h-3.5 w-3.5"/>{accuracyText}</div></div>{!sensorEnabled&&<button onClick={enableCompass} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-md transition-transform hover:scale-[1.02]"><RotateCcw className="h-4 w-4"/>تفعيل البوصلة الحية</button>}</div></div><div className="rounded-2xl border border-border bg-secondary/30 p-5"><div className="font-black">الموقع والاتجاه</div><div className="mt-4 flex items-center gap-3 text-sm"><LocateFixed className="h-5 w-5 text-primary"/><span>{pos?`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`:'جارٍ تحديد الموقع'}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-border bg-card p-3"><div className="text-xs text-muted-foreground">زاوية القبلة</div><div className="mt-1 font-black mono">{bearing==null?'--':`${Math.round(bearing)}°`}</div></div><div className="rounded-xl border border-border bg-card p-3"><div className="text-xs text-muted-foreground">اتجاه الهاتف</div><div className="mt-1 font-black mono">{heading==null?'--':`${Math.round(heading)}°`}</div></div></div><p className="mt-3 text-xs text-muted-foreground">تتبع البوصلة اتجاه هاتفك لحظيًا عند دعم الجهاز للمستشعر. لا تحتاج بيانات الحركة إلى خادم النظام.</p></div></div></>}</section></div></main>;
}
