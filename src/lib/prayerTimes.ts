export interface PrayerTimes { fajr:string; sunrise:string; dhuhr:string; asr:string; maghrib:string; isha:string; }
export interface PrayerLocation { latitude:number; longitude:number; city?:string; }
const FALLBACK: PrayerTimes = { fajr:"--:--", sunrise:"--:--", dhuhr:"--:--", asr:"--:--", maghrib:"--:--", isha:"--:--" };
export async function getPrayerTimes(location:PrayerLocation, date=new Date()):Promise<PrayerTimes>{
 const dateKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
 const url=`https://api.aladhan.com/v1/timings/${dateKey}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&method=3`;
 const res=await fetch(url); if(!res.ok) throw new Error("Prayer times unavailable");
 const json=await res.json() as {data?:{timings?:Record<string,string>}}; const t=json.data?.timings; if(!t) return FALLBACK;
 return { fajr:clean(t.Fajr), sunrise:clean(t.Sunrise), dhuhr:clean(t.Dhuhr), asr:clean(t.Asr), maghrib:clean(t.Maghrib), isha:clean(t.Isha) };
}
function clean(v?:string){return v?.slice(0,5) ?? "--:--";}
export function qiblaBearing(latitude:number, longitude:number):number{const kaabaLat=21.422487*Math.PI/180; const kaabaLon=39.826206*Math.PI/180; const lat=latitude*Math.PI/180; const lon=longitude*Math.PI/180; const dLon=kaabaLon-lon; const y=Math.sin(dLon); const x=Math.cos(lat)*Math.tan(kaabaLat)-Math.sin(lat)*Math.cos(dLon); return (Math.atan2(y,x)*180/Math.PI+360)%360;}
export function bearingLabel(deg:number){const dirs=["شمال","شمال شرقي","شرق","جنوب شرقي","جنوب","جنوب غربي","غرب","شمال غربي"];return dirs[Math.round(deg/45)%8];}
