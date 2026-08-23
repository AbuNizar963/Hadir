export interface PrayerTimes { fajr:string; sunrise:string; dhuhr:string; asr:string; maghrib:string; isha:string; }
export interface PrayerMeta { gregorian:string; hijri:string; city:string; }
export interface PrayerLocation { latitude:number; longitude:number; city?:string; }
export interface PrayerResponse { times:PrayerTimes; meta:PrayerMeta; }
const FALLBACK: PrayerTimes = { fajr:"--:--", sunrise:"--:--", dhuhr:"--:--", asr:"--:--", maghrib:"--:--", isha:"--:--" };
export async function getPrayerTimes(location:PrayerLocation, date=new Date()):Promise<PrayerResponse>{
 const dateKey=`${date.getDate()}-${String(date.getMonth()+1).padStart(2,"0")}-${date.getFullYear()}`;
 const url=`https://api.aladhan.com/v1/timings/${dateKey}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&method=3`;
 const res=await fetch(url); if(!res.ok) throw new Error("Prayer times unavailable");
 const json=await res.json() as {data?:{timings?:Record<string,string>;date?:{readable?:string;hijri?:{date?:string;month?:{ar?:string};year?:string}}}}; const data=json.data; const t=data?.timings; if(!t) return {times:FALLBACK,meta:{gregorian:"",hijri:"",city:location.city||"موقعك الحالي"}};
 const h=data?.date?.hijri; const parts=h?.date?.split("-")||[]; const hijri=parts.length===3?`${parts[0]} ${h?.month?.ar||""} ${h?.year||""} هـ`:"";
 return {times:{fajr:clean(t.Fajr),sunrise:clean(t.Sunrise),dhuhr:clean(t.Dhuhr),asr:clean(t.Asr),maghrib:clean(t.Maghrib),isha:clean(t.Isha)},meta:{gregorian:data?.date?.readable||"",hijri,city:location.city||"موقعك الحالي"}};
}
export async function getQiblaBearingFromProvider(latitude:number,longitude:number):Promise<number>{
 const url=`https://api.aladhan.com/v1/qibla/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
 const res=await fetch(url); if(!res.ok) throw new Error("Qibla provider unavailable");
 const json=await res.json() as {data?:{direction?:number}}; const direction=json.data?.direction;
 if(typeof direction!=="number" || !Number.isFinite(direction)) throw new Error("Invalid Qibla direction");
 return (direction%360+360)%360;
}
function clean(v?:string){return v?.slice(0,5) ?? "--:--";}
export function qiblaBearing(latitude:number, longitude:number):number{const kaabaLat=21.422487*Math.PI/180; const kaabaLon=39.826206*Math.PI/180; const lat=latitude*Math.PI/180; const lon=longitude*Math.PI/180; const dLon=kaabaLon-lon; const y=Math.sin(dLon); const x=Math.cos(lat)*Math.tan(kaabaLat)-Math.sin(lat)*Math.cos(dLon); return (Math.atan2(y,x)*180/Math.PI+360)%360;}
export function distanceToKaabaKm(latitude:number,longitude:number){const R=6371;const a1=latitude*Math.PI/180;const a2=21.422487*Math.PI/180;const dLat=(21.422487-latitude)*Math.PI/180;const dLon=(39.826206-longitude)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
export function bearingLabel(deg:number){const dirs=["شمال","شمال شرقي","شرق","جنوب شرقي","جنوب","جنوب غربي","غرب","شمال غربي"];return dirs[Math.round(deg/45)%8];}
