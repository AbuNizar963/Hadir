import { useEffect, useRef, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import AdminAccountsPanel from "@/components/AdminAccountsPanel";
import { getSettings, resetAll, saveSettings } from "@/lib/storage";
import { saveBackendSettings, backendEnabled } from "@/lib/backend";
import { hash } from "@/lib/hash";
import type { Settings, Location } from "@/types";

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-xs text-muted-foreground">{label}{children}</label>}

export default function ManagerSettings(){
  const [s,setS]=useState<Settings>(getSettings());
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [password,setPassword]=useState("");
  const [showLocation,setShowLocation]=useState(false);
  const [locName,setLocName]=useState("");
  const [locLat,setLocLat]=useState(s.workSiteLat);
  const [locLng,setLocLng]=useState(s.workSiteLng);
  const [locRadius,setLocRadius]=useState(s.radiusMeters);
  const printRef=useRef<HTMLDivElement>(null);
  const [loginUrl,setLoginUrl]=useState("");

  useEffect(()=>{setLoginUrl(`${window.location.origin}${import.meta.env.BASE_URL}login`);},[]);

  const save=async()=>{
    setError(null);
    const next={...s};
    if(password) next.ownerPasswordHash=hash(password);
    try{
      if(backendEnabled) await saveBackendSettings(next);
      saveSettings(next);
      setS(next);setPassword("");setSaved(true);setTimeout(()=>setSaved(false),1800);
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الإعدادات على Cloudflare");}
  };
  const addLocation=()=>{
    if(!locName.trim()) return alert("يرجى إدخال اسم الموقع");
    const location:Location={id:`loc_${Date.now()}`,name:locName.trim(),lat:locLat,lng:locLng,radiusMeters:locRadius};
    setS(prev=>({...prev,locations:[...(prev.locations||[]),location]}));setLocName("");setShowLocation(false);
  };
  const removeLocation=(id:string)=>setS(prev=>({...prev,locations:(prev.locations||[]).filter(l=>l.id!==id)}));
  const useGps=(target:"main"|"new")=>{
    if(!navigator.geolocation)return alert("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(p=>{
      if(target==="main")setS(prev=>({...prev,workSiteLat:p.coords.latitude,workSiteLng:p.coords.longitude}));
      else {setLocLat(p.coords.latitude);setLocLng(p.coords.longitude);}
    },e=>alert("تعذر تحديد الموقع: "+e.message),{enableHighAccuracy:true});
  };
  const generateQr=()=>setS(prev=>({...prev,qrCode:`HADIR-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,7).toUpperCase()}`}));
  const printQr=()=>{
    if(!printRef.current)return; const w=window.open("","_blank","width=800,height=1000");if(!w)return;
    w.document.write(`<html dir="rtl"><head><title>HADIR QR</title><style>body{font-family:system-ui;text-align:center;padding:40px}.card{border:3px solid #111;border-radius:24px;padding:30px;max-width:520px;margin:auto}img{width:360px;height:360px}</style></head><body><div class="card">${printRef.current.innerHTML}</div><script>window.onload=()=>{window.print();window.close()}</script></body></html>`);w.document.close();
  };
  const reset=()=>{if(confirm("سيتم حذف بيانات النظام المحلية وإعادة التهيئة. هل أنت متأكد؟")){resetAll();setS(getSettings());}};

  return <ManagerLayout title="الإعدادات" subtitle="إعدادات النظام والصلاحيات — المالك فقط">
    <div className="space-y-5">
      <AdminAccountsPanel />
      <section className="hud-card p-5 sm:p-6">
        <div className="text-xs mono text-primary font-bold mb-4">PROFILE · حساب المالك</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="اسم المالك"><input className="input mt-1" value={s.ownerName||"المالك"} onChange={e=>setS({...s,ownerName:e.target.value})}/></Field>
          <Field label="اسم المستخدم"><input className="input mono mt-1" value={s.ownerUsername||"AbuNizar"} onChange={e=>setS({...s,ownerUsername:e.target.value})}/></Field>
          <Field label="كلمة مرور جديدة"><input type="password" className="input mt-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="اتركها فارغة لعدم التغيير"/></Field>
        </div>
      </section>
      <section className="hud-card p-5 sm:p-6">
        <div className="text-xs mono text-muted-foreground mb-4">GPS · الموقع الرئيسي</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="خط العرض"><input type="number" step="0.000001" className="input mono mt-1" value={s.workSiteLat} onChange={e=>setS({...s,workSiteLat:+e.target.value})}/></Field>
          <Field label="خط الطول"><input type="number" step="0.000001" className="input mono mt-1" value={s.workSiteLng} onChange={e=>setS({...s,workSiteLng:+e.target.value})}/></Field>
          <Field label="النطاق بالمتر"><input type="number" min="20" max="2000" className="input mono mt-1" value={s.radiusMeters} onChange={e=>setS({...s,radiusMeters:+e.target.value})}/></Field>
        </div>
        <button type="button" className="btn-secondary mt-3" onClick={()=>useGps("main")}>📍 استخدام موقعي الحالي</button>
      </section>
      <section className="hud-card p-5 sm:p-6">
        <div className="text-xs mono text-muted-foreground mb-4">LOCATIONS · مواقع العمل</div>
        {!showLocation?<button type="button" className="btn-secondary w-full border-dashed" onClick={()=>{setShowLocation(true);setLocLat(s.workSiteLat);setLocLng(s.workSiteLng)}}>+ إضافة موقع عمل</button>:<div className="space-y-3 p-4 rounded-xl bg-secondary/30">
          <Field label="اسم الموقع"><input className="input mt-1" value={locName} onChange={e=>setLocName(e.target.value)} placeholder="مثال: الفرع الرئيسي"/></Field>
          <div className="grid grid-cols-3 gap-2"><Field label="خط العرض"><input className="input mono mt-1" value={locLat} onChange={e=>setLocLat(+e.target.value)} /></Field><Field label="خط الطول"><input className="input mono mt-1" value={locLng} onChange={e=>setLocLng(+e.target.value)} /></Field><Field label="النطاق"><input className="input mono mt-1" value={locRadius} onChange={e=>setLocRadius(+e.target.value)} /></Field></div>
          <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={()=>useGps("new")}>📍 GPS</button><button type="button" className="btn-primary" onClick={addLocation}>حفظ الموقع</button><button type="button" className="btn-secondary" onClick={()=>setShowLocation(false)}>إلغاء</button></div>
        </div>}
        <div className="mt-3 space-y-2">{(s.locations||[]).map(l=><div key={l.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/30 text-sm"><span><b>{l.name}</b><span className="block text-[10px] mono text-muted-foreground">{l.lat.toFixed(5)}, {l.lng.toFixed(5)} · {l.radiusMeters}m</span></span><button type="button" className="text-destructive text-xs" onClick={()=>removeLocation(l.id)}>حذف</button></div>)}</div>
      </section>
      <section className="hud-card p-5 sm:p-6">
        <div className="text-xs mono text-muted-foreground mb-4">QR · رمز الموقع</div>
        <div className="grid md:grid-cols-2 gap-5 items-center">
          <div><Field label="رمز QR"><input className="input mono mt-1" value={s.qrCode} onChange={e=>setS({...s,qrCode:e.target.value})}/></Field><div className="flex gap-2 mt-3"><button type="button" className="btn-secondary" onClick={generateQr}>🔄 توليد جديد</button><button type="button" className="btn-primary" onClick={printQr}>🖨️ طباعة</button></div></div>
          <div ref={printRef} className="bg-white text-black rounded-xl p-4 text-center mx-auto"><b className="block text-xl mb-2">حاضِر</b><img src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(s.qrCode||loginUrl)}`} alt="QR" className="w-48 h-48 mx-auto"/><small>{s.qrCode}</small></div>
        </div>
      </section>
      {error&&<div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm">{error}</div>}
      <div className="flex flex-wrap gap-3 items-center"><button type="button" className="btn-primary px-6" onClick={save}>حفظ الإعدادات</button>{saved&&<span className="text-primary text-sm">تم الحفظ ✓</span>}<div className="flex-1"/><button type="button" className="btn-danger text-xs" onClick={reset}>إعادة تعيين البيانات</button></div>
    </div>
  </ManagerLayout>;
}
