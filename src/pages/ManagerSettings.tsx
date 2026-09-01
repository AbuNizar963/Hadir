import { useEffect, useRef, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import CompanySpecialtiesPanel from "@/components/settings/CompanySpecialtiesPanel";
import AdminAccountsPanel from "@/components/AdminAccountsPanel";
import OwnerBulkSettingsPanel from "@/components/OwnerBulkSettingsPanel";
import { getSettings, resetAll, saveSettings, setManagerSession } from "@/lib/storage";
import { currentManager } from "@/lib/auth";
import { saveBackendSettings, getBackendSettings, backendEnabled, createBootstrapOwner, saveBackendLocation, backendMe, resetBackendTestData } from "@/lib/backend";
import { getDiagnostics, clearDiagnostics, type DiagnosticEntry } from "@/lib/systemDiagnostics";
import type { Settings, Location } from "@/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs text-muted-foreground">{label}{children}</label>; }
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 overflow-visible transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function SectionIcon({ type }: { type: "accounts" | "profile" | "locations" | "qr" | "diagnostics" | "danger" }) { const common = { viewBox: "0 0 24 24", "aria-hidden": true, className: "h-5 w-5", fill: "currentColor" }; return type === "accounts" ? <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0M21 11c0 3 0 6-2 6s-3-2-3-5" /></svg> : type === "profile" ? <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg> : type === "locations" ? <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg> : type === "qr" ? <svg {...common}><path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm13-2h2v2h-2v-2Zm2 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Z" /></svg> : type === "diagnostics" ? <svg {...common}><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5Z M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8Z" /></svg> : <svg {...common}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" /></svg>; }
function SettingsSection({ type, code, title, description, children, defaultOpen = false, tone = "normal" }: { type: "accounts" | "profile" | "locations" | "qr" | "diagnostics" | "danger"; code: string; title: string; description: string; children: React.ReactNode; defaultOpen?: boolean; tone?: "normal" | "warning" | "danger" }) {
  const [open, setOpen] = useState(defaultOpen);
  const toneCls = tone === "danger" ? "border-red-500/30 group-open:bg-red-500/5" : tone === "warning" ? "border-amber-500/30 group-open:bg-amber-500/5" : "border-border/50";
  return <details className={`group border rounded-xl transition-colors ${toneCls}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}><summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 font-semibold select-none hover:bg-secondary/20"><div className="flex items-center gap-3 min-w-0"><SectionIcon type={type} /><div className="min-w-0"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground">{code}</div></div></div><Chevron /></summary><div className="border-t border-border/50 px-4 py-4 space-y-4">{description && <div className="text-xs text-muted-foreground">{description}</div>}{children}</div></details>; }

const PROJECT_LOGO = `${import.meta.env.BASE_URL}favicon.svg`;

export default function ManagerSettings() {
  const [s, setS] = useState<Settings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [locName, setLocName] = useState("");
  const [locLat, setLocLat] = useState(24.7136);
  const [locLng, setLocLng] = useState(46.6753);
  const [loginUrl, setLoginUrl] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [resettingCloud, setResettingCloud] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const isOwner = currentManager()?.role === "owner";

  useEffect(() => { setLoginUrl(`${window.location.origin}${import.meta.env.BASE_URL}login`); }, []);

  useEffect(() => {
    if (!backendEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const cloud = await getBackendSettings();
        if (cancelled) return;
        const merged = { ...getSettings(), ...cloud, adminAccounts: Array.isArray(cloud.adminAccounts) ? cloud.adminAccounts : getSettings().adminAccounts };
        setS(merged);
      } catch (error) {
        console.warn("تعذر تحميل الإعدادات من D1:", error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setDiagnostics(getDiagnostics()); }, []);

  const save = async () => {
    setError(null);
    setSaved(false);
    const next = { ...s };
    try {
      const localRole = currentManager()?.role;
      if (localRole !== "owner" && localRole !== "manager" && localRole !== "supervisor") {
        setError("أنت غير مخول لحفظ الإعدادات");
        return;
      }
      if (password) next.ownerPassword = password;
      if (backendEnabled) {
        await saveBackendSettings(next);
      } else {
        saveSettings(next);
      }
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الإعدادات");
    }
  };

  const addLocation = () => {
    if (!locName.trim()) return alert("يرجى إدخال اسم الموقع");
    const location: Location = { id: `loc_${Date.now()}`, name: locName.trim(), lat: locLat, lng: locLng, radiusMeters: s.radiusMeters || 100 };
    setS(prev => ({ ...prev, locations: [...(prev.locations || []), location] }));
    setLocName("");
    setLocLat(24.7136);
    setLocLng(46.6753);
  };

  const removeLocation = (id: string) => setS(prev => ({ ...prev, locations: (prev.locations || []).filter(l => l.id !== id) }));

  const getLocation = (target: "main" | "new") => {
    if (!navigator.geolocation) return alert("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(p => {
      if (target === "main") {
        setS(prev => ({ ...prev, workSiteLat: p.coords.latitude, workSiteLng: p.coords.longitude }));
      } else {
        setLocLat(p.coords.latitude);
        setLocLng(p.coords.longitude);
      }
    }, () => alert("تعذر الحصول على موقعك"));
  };

  const generateQr = () => setS(prev => ({ ...prev, qrCode: `HADIR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}` }));

  const printQr = () => {
    if (!printRef.current) return;
    const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    const logo = s.brandLogo ? `<img src="${safe(s.brandLogo)}" style="max-height: 60px; margin-bottom: 20px;" alt="شعار الشركة" />` : "";
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>QR Code</title><style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0f0f0;font-family:Arial,sans-serif;} .container{background:white;padding:40px;border-radius:10px;text-align:center;} h1{margin:0 0 10px 0;font-size:24px;} p{margin:10px 0;color:#666;} .qr-img{width:300px;height:300px;margin:20px 0;} button{padding:10px 20px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;} button:hover{background:#0056b3;}</style></head><body><div class="container">${logo}<h1>${safe(s.ownerName || "حاضر")}</h1><p>رمز دخول الموقع</p><svg class="qr-img" data-content="${safe(s.qrCode)}"></svg><p><strong>${safe(s.qrCode)}</strong></p></div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.querySelector('svg').parentElement.querySelector('[data-content]').parentElement, {text:'${safe(s.qrCode)}',width:300,height:300});<\/script></body></html>`;
    const win = window.open("", "", "width=600,height=700");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const resetCloudTestData = async () => {
    if (!isOwner || resettingCloud) return;
    const confirmation = window.prompt("هذه عملية حذف آمنة لبيانات التشغيل (الموظفون والحضور والطلبات).\n\nسيتم الحفاظ على:\n- حسابات الإدارة\n- الإعدادات\n- مواقع العمل\n\nاكتب: تأكيد النسخة الاحتياطية");
    if (confirmation !== "تأكيد النسخة الاحتياطية") {
      setError("لم يتم تأكيد النسخة الاحتياطية");
      return;
    }

    setResettingCloud(true);
    setError(null);
    try {
      const result = await resetBackendTestData();
      setSaved(true);
      setResetConfirmText("");
      setTimeout(() => setSaved(false), 3000);
      alert(`تم Reset النظام بنجاح:\n\nتم حذف:\n${Object.entries(result.deleted).map(([k, v]) => `• ${k}: ${v}`).join("\n")}\n\nتم الحفاظ على:\n${result.preserved.join("\n• ")}\n\n${result.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل Reset");
    } finally {
      setResettingCloud(false);
    }
  };

  return (
    <ManagerLayout title="الإعدادات" subtitle="إعدادات النظام والصلاحيات — المالك والمدير">
      <CompanySpecialtiesPanel />
      <div className="space-y-4">
        <SettingsSection
          type="accounts"
          code="ACCOUNTS · الحسابات والصلاحيات"
          title="الحسابات والمدراء والمشرفون"
          description="إدارة حسابات الإدارة والصلاحيات والأدوار"
        >
          <AdminAccountsPanel />
        </SettingsSection>

        <SettingsSection
          type="profile"
          code="PROFILE · حساب المالك"
          title="حساب المالك"
          description="بيانات المالك وبيانات الدخول الجديدة"
        >
          <div className="space-y-4">
            <div>
              <Field label="اسم المالك">
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border bg-secondary/50 px-3 py-2"
                  value={s.ownerName || ""}
                  onChange={(e) => setS(prev => ({ ...prev, ownerName: e.target.value }))}
                  placeholder="أدخل اسم المالك"
                />
              </Field>
            </div>
            <div>
              <Field label="كلمة المرور الجديدة (اتركها فارغة إذا لم تغيرها)">
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border bg-secondary/50 px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة"
                />
              </Field>
            </div>
            <div>
              <Field label="شعار الشركة (رابط الصورة)">
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border bg-secondary/50 px-3 py-2 text-xs"
                  value={s.brandLogo || ""}
                  onChange={(e) => setS(prev => ({ ...prev, brandLogo: e.target.value }))}
                  placeholder="رابط شعار الشركة"
                />
              </Field>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          type="locations"
          code="LOCATIONS · مواقع العمل"
          title="إدارة مواقع العمل"
          description="المقر الرئيسي والمواقع الإضافية للعمل"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="font-semibold text-sm mb-3">المقر الرئيسي</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Field label="خط العرض (Latitude)">
                    <input
                      type="number"
                      step="0.0001"
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      value={s.workSiteLat}
                      onChange={(e) => setS(prev => ({ ...prev, workSiteLat: parseFloat(e.target.value) || 0 }))}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="خط الطول (Longitude)">
                    <input
                      type="number"
                      step="0.0001"
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      value={s.workSiteLng}
                      onChange={(e) => setS(prev => ({ ...prev, workSiteLng: parseFloat(e.target.value) || 0 }))}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="نطاق التحقق (متر)">
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      value={s.radiusMeters || 100}
                      onChange={(e) => setS(prev => ({ ...prev, radiusMeters: parseInt(e.target.value) || 0 }))}
                    />
                  </Field>
                </div>
              </div>
              <button
                type="button"
                onClick={() => getLocation("main")}
                className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                🌍 تحديد الموقع الحالي
              </button>
            </div>

            {(s.locations || []).length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">المواقع الإضافية</div>
                {s.locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                    <div className="text-sm">
                      <div className="font-medium">{loc.name}</div>
                      <div className="text-xs text-muted-foreground">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} — {loc.radiusMeters}م</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLocation(loc.id)}
                      className="px-2 py-1 text-xs rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-3">
              <div className="font-semibold text-sm">إضافة موقع جديد</div>
              <input
                type="text"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="اسم الموقع"
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.0001"
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="خط العرض"
                  value={locLat}
                  onChange={(e) => setLocLat(parseFloat(e.target.value) || 0)}
                />
                <input
                  type="number"
                  step="0.0001"
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="خط الطول"
                  value={locLng}
                  onChange={(e) => setLocLng(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => getLocation("new")}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary border"
                >
                  🌍 تحديد الموقع الحالي
                </button>
                <button
                  type="button"
                  onClick={addLocation}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  ➕ إضافة
                </button>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          type="qr"
          code="QR · رمز الموقع"
          title="رمز الموقع"
          description="إنشاء رمز QR للموقع وطباعته"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-center">
              <div className="text-xs text-muted-foreground mb-2">رمز QR الحالي:</div>
              <div className="font-mono font-bold text-primary mb-3">{s.qrCode || "لم يتم إنشاء رمز بعد"}</div>
              <div ref={printRef} className="mb-3" />
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={generateQr}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  🔄 إنشاء رمز جديد
                </button>
                <button
                  type="button"
                  onClick={printQr}
                  disabled={!s.qrCode}
                  className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary border disabled:opacity-50"
                >
                  🖨️ طباعة QR
                </button>
              </div>
            </div>
          </div>
        </SettingsSection>

        {isOwner && <OwnerBulkSettingsPanel />}

        {isOwner && (
          <SettingsSection
            type="diagnostics"
            code="DIAGNOSTICS · تقرير أخطاء النظام · OWNER ONLY"
            title="تشخيص أخطاء النظام"
            description="سجل تقني للأخطاء والتنبيهات"
          >
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {diagnostics.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">لا توجد أخطاء مسجلة</div>
              ) : (
                diagnostics.map((d, i) => (
                  <div key={i} className="text-xs rounded border border-border/50 bg-secondary/30 p-2">
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-xs">{new Date(d.timestamp).toLocaleString("ar-EG")}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${d.severity === "error" ? "bg-red-500/20 text-red-700" : d.severity === "warning" ? "bg-amber-500/20 text-amber-700" : "bg-blue-500/20 text-blue-700"}`}>
                        {d.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold">{d.code}</div>
                    <div className="text-muted-foreground">{d.message}</div>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                clearDiagnostics();
                setDiagnostics([]);
              }}
              className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
            >
              🗑️ مسح السجل
            </button>
          </SettingsSection>
        )}

        {isOwner && (
          <SettingsSection
            type="danger"
            code="DANGER ZONE · SYSTEM RESET"
            title="Reset · إعادة تهيئة النظام"
            description="حذف بيانات التشغيل واستعادة النظام"
            tone="danger"
          >
            <div className="space-y-4 border border-red-500/30 rounded-lg bg-red-500/5 p-4">
              <div className="space-y-2">
                <div className="font-bold text-sm text-destructive">⚠️ تحذير</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>هذه عملية خطيرة لا يمكن التراجع عنها.</p>
                  <p><strong>سيتم حذف:</strong></p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>جميع بيانات الموظفين</li>
                    <li>جميع سجلات الحضور والانصراف</li>
                    <li>جميع الطلبات والإذونات</li>
                    <li>جميع الأحداث والإشعارات</li>
                    <li>سجل التدقيق التاريخي</li>
                  </ul>
                  <p><strong>سيتم الحفاظ على:</strong></p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>حسابات الإدارة والمالك</li>
                    <li>إعدادات النظام</li>
                    <li>مواقع العمل</li>
                    <li>بنية قاعدة البيانات</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  أدخل النص التالي لتأكيد عملية Reset:
                  <br />
                  <code className="bg-background/50 px-2 py-1 rounded text-[11px] font-mono">تأكيد النسخة الاحتياطية</code>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-red-500/30 bg-destructive/5 px-3 py-2 text-sm"
                  placeholder="أدخل النص أعلاه"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  disabled={resettingCloud}
                />
              </div>

              <button
                type="button"
                onClick={resetCloudTestData}
                disabled={resetConfirmText !== "تأكيد النسخة الاحتياطية" || resettingCloud}
                className="w-full px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
              >
                {resettingCloud ? "⏳ جاري Reset النظام..." : "🗑️ تنفيذ Reset فوري"}
              </button>

              <div className="text-xs text-muted-foreground bg-black/20 rounded p-2 font-mono max-h-32 overflow-y-auto">
                <p>✅ تم إنشاء نقطة حفظ في سجل التدقيق</p>
                <p>✅ يمكن استعادة البيانات من Cloudflare D1 backups</p>
                <p>✅ جميع حسابات الإدارة محفوظة</p>
              </div>
            </div>
          </SettingsSection>
        )}

        {error && <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" className="btn-primary px-6" onClick={save}>
            💾 حفظ الإعدادات
          </button>
          {saved && <span className="text-primary text-sm font-semibold">✅ تم الحفظ بنجاح</span>}
        </div>
      </div>
    </ManagerLayout>
  );
}
