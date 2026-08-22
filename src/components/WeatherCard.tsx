import { useEffect, useState } from "react";

type WeatherState={temp:number;apparent:number;code:number;wind:number;city:string;loading:boolean;error?:string};
type WeatherCardProps={compact?:boolean;latitude?:number;longitude?:number;title?:string;className?:string};
const labels=(code:number)=>code===0?"صافي":code<=3?"غائم جزئيًا":code<=48?"ضباب":code<=67?"أمطار":code<=77?"ثلوج":code<=82?"زخات مطر":code<=86?"زخات ثلج":"عاصفة";
const icon=(code:number)=>code===0?"☀️":code<=3?"⛅":code<=48?"🌫️":code<=67?"🌧️":code<=77?"❄️":code<=82?"🌦️":code<=86?"🌨️":"⛈️";

async function readWeather(latitude:number,longitude:number,signal?:AbortSignal):Promise<WeatherState>{
 const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`,{cache:"no-store",signal});
 if(!r.ok)throw new Error("weather");
 const d=await r.json();
 return {temp:d.current.temperature_2m,apparent:d.current.apparent_temperature,code:d.current.weather_code,wind:d.current.wind_speed_10m,city:"الموقع",loading:false};
}

export default function WeatherCard({compact=false,latitude,longitude,title="الطقس",className=""}:WeatherCardProps){
 const [w,setW]=useState<WeatherState>({temp:0,apparent:0,code:0,wind:0,city:"موقعك الحالي",loading:true});
 useEffect(()=>{let cancelled=false;const controller=new AbortController();const load=()=>{
   if(latitude==null||longitude==null){
     navigator.geolocation.getCurrentPosition(async p=>{try{const next=await readWeather(p.coords.latitude,p.coords.longitude,controller.signal);if(!cancelled)setW({...next,city:"موقعك الحالي"});}catch{if(!cancelled)setW(x=>({...x,loading:false,error:"تعذر جلب الطقس"}));}},()=>{if(!cancelled)setW(x=>({...x,loading:false,error:"فعّل الموقع لعرض الطقس"}));},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
   } else readWeather(latitude,longitude,controller.signal).then(next=>{if(!cancelled)setW({...next,city:"موقع العمل"});}).catch(()=>{if(!cancelled)setW(x=>({...x,loading:false,error:"تعذر جلب الطقس"}));});
 };
 load();const id=window.setInterval(load,600000);return()=>{cancelled=true;controller.abort();window.clearInterval(id)};
 },[latitude,longitude]);
 return <section className={`hud-card weather-strip ${compact?"p-2":"p-3"} ${className}`} aria-label={title} title={title}>
   <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-[9px] text-muted-foreground truncate">{title}</div><div className="font-black text-xs truncate">{w.loading?"جاري التحديث…":w.error||w.city}</div></div><div className="text-xl shrink-0" aria-hidden="true">{w.loading?"🌍":icon(w.code)}</div></div>
   {!w.loading&&!w.error&&<div className="mt-1 flex items-center justify-between gap-2"><div className="mono text-lg font-black">{Math.round(w.temp)}°C</div><div className="text-[9px] text-muted-foreground text-left">{labels(w.code)} · {Math.round(w.wind)} كم/س</div></div>}
 </section>;
}
