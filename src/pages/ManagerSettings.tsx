import { useEffect, useRef, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getSettings, resetAll, saveSettings } from "@/lib/storage";
import { currentSession } from "@/lib/auth";
import { hash } from "@/lib/hash";
import type { Settings, Location } from "@/types";

export default function ManagerSettings() {
  const session = currentSession();
  const role = session?.role || "supervisor"; // owner, manager, supervisor
  const currentUsername = session?.jobNumber || "";

  const [s, setS] = useState<Settings>(getSettings());
  
  // حالات تعديل الحساب الحالي
  const [currentPassword, setCurrentPassword] = useState("");

  // حالات إضافة مدير / مشرف جديد (خاصة بالمالك فقط)
  const [newManagerUser, setNewManagerUser] = useState("");
  const [newManagerPass, setNewManagerPass] = useState("");
  const [newSupervisorUser, setNewSupervisorUser] = useState("");
  const [newSupervisorPass, setNewSupervisorPass] = useState("");

  const [saved, setSaved] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const printQrRef = useRef<HTMLDivElement>(null);

  // حالة إضافة موقع جديد
  const [newLocName, setNewLocName] = useState("");
  const [newLocLat, setNewLocLat] = useState(s.workSiteLat || 0);
  const [newLocLng, setNewLocLng] = useState(s.workSiteLng || 0);
  const [newLocRadius, setNewLocRadius] = useState(s.radiusMeters || 100);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginUrl(`${window.location.origin}/login`);
    }
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Settings = { ...s };
    
    // تحديث بيانات الحساب الحالي بناءً على دور المستخدم المدمج بالجلسة
    if (currentPassword) {
      const hashedPass = hash(currentPassword);
      if (role === "owner") {
        next.ownerPasswordHash = hashedPass;
      } else if (role === "manager") {
        next.managerPasswordHash = hashedPass;
      } else if (role === "supervisor") {
        next.supervisorPasswordHash = hashedPass;
      }
    }

    // إذا كان المالك أضاف مديراً جديداً
    if (role === "owner" && newManagerUser) {
      next.managerUsername = newManagerUser;
      if (newManagerPass) next.managerPasswordHash = hash(newManagerPass);
    }

    // إذا كان المالك أضاف مشرفاً جديداً
    if (role === "owner" && newSupervisorUser) {
      next.supervisorUsername = newSupervisorUser;
      if (newSupervisorPass) next.supervisorPasswordHash = hash(newSupervisorPass);
    }
    
    saveSettings(next);
    setCurrentPassword("");
    setNewManagerPass("");
    setNewSupervisorPass("");
    setSaved(true);
    alert("تم حفظ الإعدادات بنجاح ✅");
    setTimeout(() => setSaved(false), 1800);
  };

  const generateNewQrCode = () => {
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newCode = `HADIR-${dateStr}-${randomStr}`;
    setS((prev) => ({ ...prev, qrCode: newCode }));
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) return alert("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setS({
          ...s,
          workSiteLat: p.coords.latitude,
          workSiteLng: p.coords.longitude,
        });
        setNewLocLat(p.coords.latitude);
        setNewLocLng(p.coords.longitude);
      },
      (err) => alert("تعذر تحديد الموقع: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  const addLocation = () => {
    if (!newLocName.trim()) return alert("يرجى إدخال اسم الموقع");
    const newLocation: Location = {
      id: "loc_" + Date.now(),
      name: newLocName.trim(),
      lat: newLocLat,
      lng: newLocLng,
      radiusMeters: newLocRadius,
    };
    const updatedLocations = [...(s.locations || []), newLocation];
    setS({ ...s, locations: updatedLocations });
    setNewLocName("");
  };

  const removeLocation = (id: string) => {
    const updatedLocations = (s.locations || []).filter((loc) => loc.id !== id);
    setS({ ...s, locations: updatedLocations });
  };

  const printQRCode = () => {
    if (!printQrRef.current) return;
    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;
    const qrCardHtml = printQrRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة بطاقة QR - تسجيل الحضور</title>
          <style>
            * { box-sizing: border-box; }
            @page { size: A4 portrait; margin: 0; }
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; background: #fff; }
            .print-card { border: 4px solid #1e293b; border-radius: 32px; padding: 48px 32px; text-align: center; width: 90%; max-width: 650px; background: #fff; }
            .brand-name { font-size: 48px !important; font-weight: 900 !important; color: #0f172a !important; margin-bottom: 32px !important; }
            .qr-img { width: 380px !important; height: 380px !important; object-fit: contain; margin: 0 auto 32px !important; display: block; }
            .url-text { font-size: 16px !important; font-family: monospace; color: #475569 !important; word-break: break-all; direction: ltr; margin-bottom: 24px !important; }
            .instructions { font-size: 24px !important; font-weight: 800 !important; color: #1e293b !important; }
          </style>
        </head>
        <body>
          <div class="print-card">${qrCardHtml}</div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const doReset = () => {
    if (!confirm("سيتم مسح جميع البيانات واستعادة البيانات الأساسية.")) return;
    resetAll();
    setS(getSettings());
  };

  const qrDataToEncode = s.qrCode || loginUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrDataToEncode)}`;

  return (
    <ManagerLayout
      title="الإعدادات"
      subtitle="إدارة المواقع، النطاق، مولد QR، والحسابات"
    >
      <form onSubmit={save} className="grid lg:grid-cols-2 gap-5">
        
        {/* موقع مقر العمل الرئيسي */}
        <section className="hud-card p-5 sm:p-6">
          <div className="text-xs mono text-muted-foreground mb-3">
            GPS · الموقع الرئيسي لمقر العمل
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="خط العرض">
              <input
                className="input mono"
                type="number"
                step="0.000001"
                value={s.workSiteLat}
                onChange={(e) => setS({ ...s, workSiteLat: +e.target.value })}
              />
            </Field>
            <Field label="خط الطول">
              <input
                className="input mono"
                type="number"
                step="0.000001"
                value={s.workSiteLng}
                onChange={(e) => setS({ ...s, workSiteLng: +e.target.value })}
              />
            </Field>
            <Field label="نطاق النقطة (متر)">
              <input
                className="input mono"
                type="number"
                min={20}
                max={2000}
                value={s.radiusMeters}
                onChange={(e) => setS({ ...s, radiusMeters: +e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <button type="button" onClick={useCurrentLocation} className="btn-secondary w-full text-xs">
                استخدام موقعي الحالي
              </button>
            </div>
          </div>
        </section>

        {/* إضافة مواقع عمل فرعية جديدة */}
        <section className="hud-card p-5 sm:p-6">
          <div className="text-xs mono text-muted-foreground mb-3">
            LOCATIONS · إضافة مواقع ومقرات عمل أخرى
          </div>
          <div className="space-y-3 mb-4">
            <Field label="اسم الموقع الجديد">
              <input
                className="input"
                placeholder="مثال: فرع الإدارة الجديدة"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="خط العرض">
                <input type="number" step="0.000001" className="input mono text-xs" value={newLocLat} onChange={(e) => setNewLocLat(+e.target.value)} />
              </Field>
              <Field label="خط الطول">
                <input type="number" step="0.000001" className="input mono text-xs" value={newLocLng} onChange={(e) => setNewLocLng(+e.target.value)} />
              </Field>
              <Field label="النطاق (متر)">
                <input type="number" className="input mono text-xs" value={newLocRadius} onChange={(e) => setNewLocRadius(+e.target.value)} />
              </Field>
            </div>
            <button type="button" onClick={addLocation} className="btn-secondary w-full text-xs">
              + إضافة الموقع إلى قائمة المواقع
            </button>
          </div>

          {s.locations && s.locations.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2 max-h-32 overflow-y-auto">
              {s.locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-xs">
                  <div>
                    <span className="font-bold">{loc.name}</span>
                    <span className="text-muted-foreground block text-[10px] mono">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                  </div>
                  <button type="button" onClick={() => removeLocation(loc.id)} className="text-destructive font-bold px-2 py-1">حذف</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* مولد رمز QR */}
        <section className="hud-card p-5 sm:p-6 lg:col-span-2">
          <div className="text-xs mono text-muted-foreground mb-3">QR GENERATOR · مولد رمز QR اليومي</div>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <Field label="رمز QR الحالي">
                <div className="flex gap-2">
                  <input
                    className="input mono text-xs bg-secondary/30 flex-1"
                    value={s.qrCode || ""}
                    onChange={(e) => setS({ ...s, qrCode: e.target.value })}
                  />
                  <button type="button" onClick={generateNewQrCode} className="btn-secondary text-xs shrink-0">
                    🔄 توليد رمز جديد
                  </button>
                </div>
              </Field>
              <button type="button" onClick={printQRCode} className="btn-primary text-xs w-full md:w-auto">
                🖨️ طباعة بطاقة QR للموقع
              </button>
            </div>

            <div className="flex justify-center">
              <div ref={printQrRef} className="p-4 bg-white text-black rounded-xl border border-gray-300 flex flex-col items-center gap-2 w-60 text-center">
                <div className="brand-name text-sm font-extrabold text-gray-800">حاضِر</div>
                <img src={qrImageUrl} alt="QR" className="qr-img w-40 h-40 object-contain border p-1 rounded bg-white" />
                <div className="url-text text-[10px] font-mono text-gray-600 break-all dir-ltr">{s.qrCode || loginUrl}</div>
                <div className="instructions text-[10px] text-gray-500 font-bold">امسح الرمز لتسجيل الحضور</div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. حساب المالك أو المدير أو المشرف (حسب الجلسة الحالية) */}
        <section className="hud-card p-5 sm:p-6 lg:col-span-2">
          <div className="text-xs mono text-muted-foreground mb-3">
            ACCOUNT SETTINGS · إعدادات الحساب الحالي ({role.toUpperCase()})
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="اسم المستخدم الحالي">
              <input className="input bg-secondary/50" value={currentUsername} disabled />
            </Field>
            <Field label="تغيير كلمة المرور الجديدة">
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="•••••••• (اتركها فارغة إن لمن ترد التغيير)"
              />
            </Field>
          </div>
        </section>

        {/* 2. خيارات المالك فقط: إضافة مدير جديد أو مشرف جديد */}
        {role === "owner" && (
          <section className="hud-card p-5 sm:p-6 lg:col-span-2 border-primary/40 border">
            <div className="text-xs mono text-primary mb-3 font-bold">
              OWNER EXCLUSIVE · إنشاء وتعديل صلاحيات المدراء والمشرفين
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* إضافة مدير */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/20">
                <div className="text-xs font-bold">إدارة حساب المدير</div>
                <Field label="اسم مستخدم المدير">
                  <input
                    className="input"
                    value={newManagerUser || s.managerUsername || ""}
                    onChange={(e) => setNewManagerUser(e.target.value)}
                    placeholder="اسم المدير الجديد"
                  />
                </Field>
                <Field label="كلمة المرور الجديدة للمدير">
                  <input
                    type="password"
                    className="input"
                    value={newManagerPass}
                    onChange={(e) => setNewManagerPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              </div>

              {/* إضافة مشرف */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/20">
                <div className="text-xs font-bold">إدارة حساب المشرف</div>
                <Field label="اسم مستخدم المشرف">
                  <input
                    className="input"
                    value={newSupervisorUser || s.supervisorUsername || ""}
                    onChange={(e) => setNewSupervisorUser(e.target.value)}
                    placeholder="اسم المشرف الجديد"
                  />
                </Field>
                <Field label="كلمة المرور الجديدة للمشرف">
                  <input
                    type="password"
                    className="input"
                    value={newSupervisorPass}
                    onChange={(e) => setNewSupervisorPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              </div>
            </div>
          </section>
        )}

        {/* أزرار الحفظ */}
        <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
          <button className="btn-primary">حفظ الإعدادات</button>
          {saved && <span className="text-primary text-sm">تم الحفظ ✓</span>}
          {role === "owner" && (
            <>
              <div className="flex-1" />
              <button type="button" onClick={doReset} className="btn-danger text-xs">
                إعادة تعيين كل البيانات
              </button>
            </>
          )}
        </div>
      </form>
    </ManagerLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
