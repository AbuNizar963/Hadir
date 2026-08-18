import { useEffect, useRef, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getSettings, resetAll, saveSettings } from "@/lib/storage";
import { hash } from "@/lib/hash";
import type { Settings, Location } from "@/types";

export default function ManagerSettings() {
  const [s, setS] = useState<Settings>(getSettings());
  
  // 1. إضافة الحقول الجديدة للأدوار بعد استدعاء useState(getSettings())
  const [managerName, setManagerName] = useState(s.managerName || "");
  const [managerPassword, setManagerPassword] = useState("");
  const [ownerName, setOwnerName] = useState(s.ownerName || "");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [supervisorName, setSupervisorName] = useState(s.supervisorName || "");
  const [supervisorPassword, setSupervisorPassword] = useState("");

  const [pw, setPw] = useState("");
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
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

  // 2. تحديث دالة الحفظ (save / saveAll) لتشمل الأدوار الجديدة
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Settings = { ...s };
    
    if (managerName) next.managerName = managerName;
    if (managerPassword) next.managerPasswordHash = hash(managerPassword);
    
    if (ownerName) next.ownerName = ownerName;
    if (ownerPassword) next.ownerPasswordHash = hash(ownerPassword);
    
    if (supervisorName) next.supervisorName = supervisorName;
    if (supervisorPassword) next.supervisorPasswordHash = hash(supervisorPassword);

    if (pw) next.managerPasswordHash = hash(pw);
    
    saveSettings(next);
    setPw("");
    setManagerPassword("");
    setOwnerPassword("");
    setSupervisorPassword("");
    setSaved(true);
    alert("تم حفظ الإعدادات بنجاح ✅");
    setTimeout(() => setSaved(false), 1800);
  };

  // دالة توليد رمز QR جديد تلقائياً بحسب التاريخ والوقت
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

  // إضافة موقع عمل جديد إلى قائمة المواقع
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

  // حذف موقع عمل من القائمة
  const removeLocation = (id: string) => {
    const updatedLocations = (s.locations || []).filter((loc) => loc.id !== id);
    setS({ ...s, locations: updatedLocations });
  };

  // طباعة بطاقة الـ QR بكتلة كبيرة ملء صفحة A4
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
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background-color: #ffffff;
            }
            .print-card {
              border: 4px solid #1e293b;
              border-radius: 32px;
              padding: 48px 32px;
              text-align: center;
              width: 90%;
              max-width: 650px;
              background: #ffffff;
              box-shadow: none;
            }
            .brand-name {
              font-size: 48px !important;
              font-weight: 900 !important;
              color: #0f172a !important;
              margin-bottom: 32px !important;
            }
            .qr-img {
              width: 380px !important;
              height: 380px !important;
              object-fit: contain;
              margin: 0 auto 32px !important;
              display: block;
            }
            .url-text {
              font-size: 16px !important;
              font-family: monospace;
              color: #475569 !important;
              word-break: break-all;
              direction: ltr;
              margin-bottom: 24px !important;
            }
            .instructions {
              font-size: 24px !important;
              font-weight: 800 !important;
              color: #1e293b !important;
            }
            @media print {
              body { 
                min-height: 100vh; 
              }
            }
          </style>
        </head>
        <body>
          <div class="print-card">
            ${qrCardHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const doReset = () => {
    if (
      !confirm(
        "سيتم مسح جميع البيانات (موظفين، حضور، سجل تدقيق، إعدادات) واستعادة البيانات الأولية."
      )
    )
      return;
    resetAll();
    setS(getSettings());
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("يرجى اختيار ملف صورة صالح.");
      return;
    }
    if (file.size > 500 * 1024) {
      setLogoError("حجم الشعار يجب أن يكون أقل من 500 كيلوبايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setS({ ...s, brandLogo: reader.result as string });
    };
    reader.onerror = () => setLogoError("تعذّر قراءة ملف الصورة.");
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setS({ ...s, brandLogo: null });
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // توليد رابط صورة الـ QR بدقة عالية على أساس قيمة رمز الـ QR اليومي المحفوظة
  const qrDataToEncode = s.qrCode || loginUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    qrDataToEncode
  )}`;

  return (
    <ManagerLayout
      title="الإعدادات"
      subtitle="الهوية البصرية، المواقع المتعددة، النطاق، ومولد QR"
    >
      <form onSubmit={save} className="grid lg:grid-cols-2 gap-5">
        {/* الهوية البصرية للمنصة */}
        <section className="hud-card p-5 sm:p-6 lg:col-span-2">
          <div className="text-xs mono text-muted-foreground mb-3">
            BRAND · الهوية البصرية للمنصة
          </div>
          <div className="grid sm:grid-cols-[auto,1fr,auto] items-center gap-4">
            <div className="flex items-center gap-3">
              {s.brandLogo ? (
                <img
                  src={s.brandLogo}
                  alt="شعار الجهة"
                  className="h-16 w-16 rounded-2xl object-cover border-2 border-primary/40"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-secondary/60 border-2 border-dashed border-border grid place-items-center">
                  <LogoIcon />
                </div>
              )}
            </div>
            <div className="space-y-2 min-w-0">
              <Field label="اسم الجهة / المنصة">
                <input
                  className="input"
                  value={s.brandName ?? ""}
                  onChange={(e) => setS({ ...s, brandName: e.target.value })}
                  placeholder="حاضِر"
                />
              </Field>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                يظهر الاسم والشعار في رأس كل صفحات النظام. الحد الأقصى للحجم 500 كيلوبايت.
              </div>
              {logoError && (
                <div className="text-[11px] text-destructive font-semibold">
                  {logoError}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <label className="btn-secondary cursor-pointer text-xs text-center">
                رفع شعار جديد
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {s.brandLogo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-[11px] text-destructive hover:brightness-125 font-semibold"
                >
                  إزالة الشعار
                </button>
              )}
            </div>
          </div>
        </section>

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
                onChange={(e) =>
                  setS({ ...s, workSiteLat: +e.target.value })
                }
              />
            </Field>
            <Field label="خط الطول">
              <input
                className="input mono"
                type="number"
                step="0.000001"
                value={s.workSiteLng}
                onChange={(e) =>
                  setS({ ...s, workSiteLng: +e.target.value })
                }
              />
            </Field>
            <Field label="نطاق النقطة (متر)">
              <input
                className="input mono"
                type="number"
                min={20}
                max={2000}
                value={s.radiusMeters}
                onChange={(e) =>
                  setS({ ...s, radiusMeters: +e.target.value })
                }
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="btn-secondary w-full text-xs"
              >
                استخدام موقعي الحالي
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-6">
            الموقع الافتراضي لتسجيل الحضور.
          </p>
        </section>

        {/* إدارة مواقع العمل المتعددة */}
        <section className="hud-card p-5 sm:p-6">
          <div className="text-xs mono text-muted-foreground mb-3">
            LOCATIONS · إدارة الفروع والمواقع المتعددة
          </div>
          <div className="space-y-3 mb-4">
            <Field label="اسم الفرع / الموقع الجديد">
              <input
                className="input"
                placeholder="مثال: الفرع الإقليمي - حلب"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="خط العرض">
                <input
                  type="number"
                  step="0.000001"
                  className="input mono text-xs"
                  value={newLocLat}
                  onChange={(e) => setNewLocLat(+e.target.value)}
                />
              </Field>
              <Field label="خط الطول">
                <input
                  type="number"
                  step="0.000001"
                  className="input mono text-xs"
                  value={newLocLng}
                  onChange={(e) => setNewLocLng(+e.target.value)}
                />
              </Field>
              <Field label="النطاق (متر)">
                <input
                  type="number"
                  className="input mono text-xs"
                  value={newLocRadius}
                  onChange={(e) => setNewLocRadius(+e.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={addLocation}
              className="btn-secondary w-full text-xs"
            >
              + إضافة الموقع إلى القائمة
            </button>
          </div>

          {/* قائمة المواقع المضافة */}
          {s.locations && s.locations.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2 max-h-40 overflow-y-auto">
              <div className="text-xs font-semibold text-muted-foreground">الفروع المضافة:</div>
              {s.locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-xs"
                >
                  <div>
                    <span className="font-bold">{loc.name}</span>
                    <span className="text-muted-foreground block text-[10px] mono">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} ({loc.radiusMeters}m)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLocation(loc.id)}
                    className="text-destructive font-bold px-2 py-1 hover:bg-destructive/10 rounded"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* مولد وطباعة رمز QR اليومي */}
        <section className="hud-card p-5 sm:p-6 lg:col-span-2">
          <div className="text-xs mono text-muted-foreground mb-3">
            QR GENERATOR · إدارة ومولد رمز QR اليومي
          </div>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <Field label="رمز QR اليومي">
                <div className="flex gap-2">
                  <input
                    className="input mono text-xs bg-secondary/30 flex-1"
                    value={s.qrCode || ""}
                    onChange={(e) => setS({ ...s, qrCode: e.target.value })}
                    placeholder="HADIR-SITE-01-STATIC"
                  />
                  <button
                    type="button"
                    onClick={generateNewQrCode}
                    className="btn-secondary text-xs shrink-0"
                  >
                    🔄 توليد رمز جديد
                  </button>
                </div>
              </Field>
              <p className="text-xs text-muted-foreground leading-6">
                قم بتوليد رمز جديد يومياً لحماية تسجيل الحضور من التلاعب، ثم اضغط على زر التحديث واطبع البطاقة لعرضها في مدخل مقر العمل.
              </p>
              <button
                type="button"
                onClick={printQRCode}
                className="btn-primary text-xs w-full md:w-auto"
              >
                🖨️ طباعة بطاقة QR للموقع
              </button>
            </div>

            {/* معاينة بطاقة الطباعة */}
            <div className="flex justify-center">
              <div
                ref={printQrRef}
                className="p-4 bg-white text-black rounded-xl border border-gray-300 flex flex-col items-center gap-2 shadow-sm text-center w-60"
              >
                <div className="brand-name text-sm font-extrabold text-gray-800">
                  {s.brandName || "حاضِر"}
                </div>
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  className="qr-img w-40 h-40 object-contain border p-1 rounded bg-white"
                />
                <div className="url-text text-[10px] font-mono text-gray-600 break-all dir-ltr">
                  {s.qrCode || loginUrl}
                </div>
                <div className="instructions text-[10px] text-gray-500 font-bold">
                  امسح الرمز لتسجيل الحضور والانصراف
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. إضافة واجهة المالك */}
        <div className="hud-card p-5 mb-6 lg:col-span-2">
          <h2 className="text-lg font-bold mb-3">إعدادات المالك</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="اسم المالك">
              <input
                className="input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="اسم المالك"
              />
            </Field>
            <Field label="كلمة مرور المالك">
              <input
                type="password"
                className="input"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            صلاحيات كاملة لإدارة النظام المالي والإداري.
          </div>
        </div>

        {/* 4. إضافة واجهة المشرف مع زر إعادة الضبط */}
        <div className="hud-card p-5 mb-6 lg:col-span-2">
          <h2 className="text-lg font-bold mb-3">إعدادات المشرف وإدارة النظام</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Field label="اسم المشرف">
              <input
                className="input"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="اسم المشرف"
              />
            </Field>
            <Field label="كلمة مرور المشرف">
              <input
                type="password"
                className="input"
                value={supervisorPassword}
                onChange={(e) => setSupervisorPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("هل تريد إعادة ضبط الجهاز بالكامل؟")) {
                doReset();
                alert("تمت إعادة الضبط ⚠️");
              }
            }}
            className="bg-red-700 px-3 py-1 rounded-lg mt-3 text-white text-xs hover:bg-red-800 transition"
          >
            إعادة ضبط الجهاز
          </button>
        </div>

        {/* كلمة مرور المدير التقليدية */}
        <section className="hud-card p-5 sm:p-6 lg:col-span-2">
          <div className="text-xs mono text-muted-foreground mb-3">
            SECURITY · كلمة مرور المدير الرئيسية
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="اسم المدير">
              <input
                className="input"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="اسم المدير"
              />
            </Field>
            <Field label="كلمة مرور جديدة (اتركها فارغة للإبقاء عليها)">
              <input
                type="password"
                className="input"
                value={managerPassword || pw}
                onChange={(e) => {
                  setManagerPassword(e.target.value);
                  setPw(e.target.value);
                }}
                placeholder="••••••••"
              />
            </Field>
          </div>
        </section>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
          <button className="btn-primary">حفظ الإعدادات</button>
          {saved && <span className="text-primary text-sm">تم الحفظ ✓</span>}
          <div className="flex-1" />
          <button
            type="button"
            onClick={doReset}
            className="btn-danger text-xs"
          >
            إعادة تعيين كل البيانات
          </button>
        </div>
      </form>
    </ManagerLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function LogoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
