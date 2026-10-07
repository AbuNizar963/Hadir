import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { toast, userFacingError } from "@/components/system/ToastProvider";
import ManagerLayout from "@/components/layout/ManagerLayout";
import CompanySpecialtiesPanel from "@/components/settings/CompanySpecialtiesPanel";
import AdminAccountsPanel from "@/components/AdminAccountsPanel";
import OwnerBulkSettingsPanel from "@/components/OwnerBulkSettingsPanel";
import LocationPicker from "@/components/settings/LocationPicker";
import { getCurrentPosition } from "@/lib/geo";
import { getSettings, resetAll, saveSettings, setManagerSession } from "@/lib/storage";
import { currentManager } from "@/lib/auth";
import { saveBackendSettings, getBackendSettings, backendEnabled, createBootstrapOwner, saveBackendLocation, deleteBackendLocation, backendMe, resetBackendTestData, getHolidayCountries } from "@/lib/backend";
import { getDiagnostics, clearDiagnostics, type DiagnosticEntry } from "@/lib/systemDiagnostics";
import type { Settings, Location } from "@/types";
import { DEFAULT_SYSTEM_TIME_ZONE, SYSTEM_TIME_ZONES, getSystemTimeZone, getTimeZoneOffsetLabel, getTimeZoneOptionLabel, isValidSystemTimeZone, setSystemTimeZone } from "@/lib/systemTimezone";

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs text-muted-foreground">{label}{children}</label>; }
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 overflow-visible transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function SectionIcon({ type }: { type: "accounts" | "profile" | "locations" | "qr" | "diagnostics" | "danger" }) { const common = { viewBox: "0 0 24 24", "aria-hidden": true, className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }; if (type === "accounts") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>; if (type === "profile") return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M19 4h3v3"/></svg>; if (type === "locations") return <svg {...common}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>; if (type === "qr") return <svg {...common}><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h3v3h-3zM20 17v3M17 20h3"/></svg>; if (type === "diagnostics") return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><path d="m9.5 12 1.7 1.7 3.5-3.5"/></svg>; return <svg {...common}><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"/><path d="M12 8v5M12 16h.01"/></svg>; }
function SettingsSection({ type, code, title, description, children, defaultOpen = false, tone = "normal" }: { type: "accounts" | "profile" | "locations" | "qr" | "diagnostics" | "danger"; code: string; title: string; description: string; children: React.ReactNode; defaultOpen?: boolean; tone?: "normal" | "danger" | "primary" }) { return <details open={defaultOpen} data-settings-accordion className={`hud-card group overflow-visible ${tone === "danger" ? "border-destructive/40" : tone === "primary" ? "border-primary/30" : ""}`}><summary className="list-none cursor-pointer select-none p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-primary/5 transition-colors"><div className="flex items-center gap-3 min-w-0"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><SectionIcon type={type} /></span><span className="min-w-0"><span className={`flex items-center gap-2 text-xs mono font-bold ${tone === "danger" ? "text-destructive" : "text-primary"}`}>{code}</span><span className="block mt-1 text-base font-bold">{title}</span><span className="block mt-1 text-xs text-muted-foreground">{description}</span></span></div><Chevron /></summary><div className="border-t border-border/60 p-5 sm:p-6">{children}</div></details>; }
const PROJECT_LOGO = `${import.meta.env.BASE_URL}favicon.svg`;
const displayHolidayCountry = (country: { code: string; name: string }) => { try { return new Intl.DisplayNames(["ar"], { type: "region" }).of(country.code) || country.name; } catch { return country.name; } };
type SettingsTab = "profile" | "locations" | "security" | "advanced";
type SettingsIcon = "accounts" | "profile" | "locations" | "diagnostics" | "clock";
const tabs: Array<{ id: SettingsTab; label: string; hint: string; icon: SettingsIcon; code: string }> = [
  { id: "profile", label: "الملف الشخصي للشركة", hint: "الاسم والشعار والتخصصات والوقت والعطل", icon: "profile", code: "01" },
  { id: "locations", label: "مواقع الدوام", hint: "المقر والفروع", icon: "locations", code: "02" },
  { id: "security", label: "إدارة الموظفين", hint: "سياسات الموظفين", icon: "accounts", code: "03" },
  { id: "advanced", label: "صيانة النظام", hint: "التشخيص والصيانة", icon: "diagnostics", code: "05" },
];

function TabIcon({ type }: { type: SettingsIcon }) {
  if (type === "clock") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  return <SectionIcon type={type} />;
}

export default function ManagerSettings() {
  const [s, setS] = useState<Settings>(getSettings()); const [saved, setSaved] = useState(false); const [savingSettings, setSavingSettings] = useState(false); const [savingLocation, setSavingLocation] = useState(false); const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [password, setPassword] = useState(""); const [showLocation, setShowLocation] = useState(false); const [editingLocationId, setEditingLocationId] = useState<string | null>(null); const [locName, setLocName] = useState(""); const [locLat, setLocLat] = useState(s.workSiteLat); const [locLng, setLocLng] = useState(s.workSiteLng); const [locRadius, setLocRadius] = useState(s.radiusMeters); const printRef = useRef<HTMLDivElement>(null); const settingsRef = useRef<HTMLDivElement>(null); const [loginUrl, setLoginUrl] = useState(""); const [showDiagnostics, setShowDiagnostics] = useState(false); const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]); const [resettingCloud, setResettingCloud] = useState(false); const [resetCloudResult, setResetCloudResult] = useState<string | null>(null);   const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null); const [categoryListOpen, setCategoryListOpen] = useState(true); const manager = currentManager(); const navigate = useNavigate(); const isOwner = manager?.role === "owner" || manager?.accountId === "bootstrap"; const extraLocations = (s.locations || []).filter((location) => String(location.name || "").trim() !== "المقر الرئيسي");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const filteredTimeZones = SYSTEM_TIME_ZONES.filter((zone) => `${zone} ${zone === "Asia/Damascus" ? "دمشق سوريا" : ""}`.toLocaleLowerCase().includes(timezoneSearch.trim().toLocaleLowerCase()));
  const [holidayCountries, setHolidayCountries] = useState<Array<{ code: string; name: string; nameEn: string }>>([]);
  useEffect(() => { setLoginUrl(`${window.location.origin}${import.meta.env.BASE_URL}login`); }, []);
  useEffect(() => { if (!backendEnabled) return; void getHolidayCountries().then((result) => setHolidayCountries(result.countries || [])).catch(() => setHolidayCountries([])); }, []);
  useEffect(() => { if (!backendEnabled) return; let cancelled = false; void (async () => { try { const cloud = await getBackendSettings(); if (cancelled) return; const merged = { ...getSettings(), ...cloud, adminAccounts: Array.isArray(cloud.adminAccounts) ? cloud.adminAccounts : getSettings().adminAccounts, timezone: isValidSystemTimeZone(cloud.timezone) ? cloud.timezone : DEFAULT_SYSTEM_TIME_ZONE } as Settings; if (!isValidSystemTimeZone(merged.timezone)) merged.timezone = DEFAULT_SYSTEM_TIME_ZONE; saveSettings(merged); setSystemTimeZone(merged.timezone || DEFAULT_SYSTEM_TIME_ZONE); setS(merged); setLocLat(merged.workSiteLat); setLocLng(merged.workSiteLng); setLocRadius(merged.radiusMeters); } catch (e) { console.warn("تعذر تحميل إعدادات الخادم:", e); } })(); return () => { cancelled = true; }; }, []);
  useEffect(() => { const root = settingsRef.current; if (!root) return; const onToggle = (event: Event) => { const opened = event.target as HTMLDetailsElement; if (!(opened instanceof HTMLDetailsElement) || !opened.open || !opened.matches("[data-settings-accordion]")) return; const panel = opened.closest(".settings-tab-panel"); if (!panel) return; panel.querySelectorAll<HTMLDetailsElement>("[data-settings-accordion][open]").forEach((item) => { if (item !== opened) item.open = false; }); }; root.addEventListener("toggle", onToggle, true); return () => root.removeEventListener("toggle", onToggle, true); }, []);
  const save = async () => { if (savingSettings) return; setSavingSettings(true); setError(null); setSaved(false); const next = { ...s, timezone: s.timezone || DEFAULT_SYSTEM_TIME_ZONE }; try { if (!isValidSystemTimeZone(next.timezone)) { setError("المنطقة الزمنية المختارة غير صالحة."); return; } const localRole = currentManager()?.role; if (localRole !== "owner" && localRole !== "manager" && localRole !== "admin" && localRole !== undefined) { setError("هذه العملية متاحة للمالك أو المدير فقط."); return; } if (!Number.isFinite(Number(next.workSiteLat)) || !Number.isFinite(Number(next.workSiteLng)) || !Number.isFinite(Number(next.radiusMeters)) || Number(next.radiusMeters) <= 0) { setError("إحداثيات الموقع والنطاق غير صالحة."); return; } const bootstrap = currentManager()?.accountId === "bootstrap"; if (bootstrap && backendEnabled) { if (!next.ownerName?.trim() || !next.ownerUsername?.trim() || password.length < 12) { setError("في أول إعداد أدخل اسم المالك واسم المستخدم وكلمة مرور من 12 محرفًا على الأقل."); return; } const owner = await createBootstrapOwner({ name: next.ownerName.trim(), username: next.ownerUsername.trim(), password }); next.ownerPasswordHash = ""; next.adminAccounts = [{ id: owner.id, username: owner.username, passwordHash: "", name: owner.name, role: "owner", active: true, createdAt: new Date().toISOString() }]; setManagerSession({ loginAt: new Date().toISOString(), name: owner.name, role: "owner", jobNumber: owner.username, accountId: owner.id }); } else if (backendEnabled) { const remote = await backendMe(); if (remote.user?.role !== "owner" && remote.user?.role !== "manager") { setError("جلسة الإدارة الحالية غير صالحة للحفظ. سجّل الدخول من جديد."); return; } await saveBackendSettings(next); } if (backendEnabled) { await saveBackendLocation({ id: "main", name: "المقر الرئيسي", lat: Number(next.workSiteLat), lng: Number(next.workSiteLng), radiusMeters: Number(next.radiusMeters) }); for (const location of next.locations || []) { if (![location.lat, location.lng, location.radiusMeters].every(Number.isFinite) || Number(location.radiusMeters) <= 0) throw new Error(`بيانات الموقع «${location.name || location.id}» غير صالحة.`); await saveBackendLocation(location); } } else saveSettings(next); setS(next); setSystemTimeZone(next.timezone || DEFAULT_SYSTEM_TIME_ZONE); setPassword(""); setSaved(true); toast.success("تم حفظ الإعدادات بنجاح"); window.setTimeout(() => setSaved(false), 1800); } catch (e) { console.error("تعذر حفظ الإعدادات:", e); const message = userFacingError(e, "تعذر حفظ الإعدادات"); setError(message); toast.error("تعذر حفظ الإعدادات", message); } finally { setSavingSettings(false); } };
  const resetLocationForm = () => { setEditingLocationId(null); setLocName(""); setLocLat(s.workSiteLat); setLocLng(s.workSiteLng); setLocRadius(s.radiusMeters); setShowLocation(false); };
  const startEditLocation = (location: Location) => { setEditingLocationId(location.id); setLocName(location.name || ""); setLocLat(Number(location.lat)); setLocLng(Number(location.lng)); setLocRadius(Number(location.radiusMeters)); setShowLocation(true); };
  const saveLocation = async () => { if (savingLocation) return; if (!locName.trim()) { toast.warning("يرجى إدخال اسم الموقع"); return; } if (![locLat, locLng, locRadius].every(Number.isFinite) || Number(locRadius) <= 0) { toast.warning("بيانات الموقع غير صالحة"); return; } const location: Location = { id: editingLocationId || `loc_${Date.now()}`, name: locName.trim(), lat: Number(locLat), lng: Number(locLng), radiusMeters: Number(locRadius) }; setSavingLocation(true); try { if (backendEnabled) await saveBackendLocation(location); setS(prev => { const locations = [...(prev.locations || [])]; const index = locations.findIndex(l => l.id === location.id); if (index >= 0) locations[index] = location; else locations.push(location); const next = { ...prev, locations }; if (!backendEnabled) saveSettings(next); return next; }); toast.success(editingLocationId ? "تم تحديث الموقع بنجاح" : "تم حفظ الموقع بنجاح"); resetLocationForm(); } catch (e) { console.error("تعذر حفظ الموقع:", e); toast.error(editingLocationId ? "تعذر تحديث الموقع" : "تعذر حفظ الموقع", userFacingError(e, "تعذر حفظ الموقع. حاول مرة أخرى.")); } finally { setSavingLocation(false); } };
  const removeLocation = async (id: string) => { if (deletingLocationId) return; if (!window.confirm("هل تريد حذف هذا الموقع؟ لا يمكن التراجع عن العملية.")) return; setDeletingLocationId(id); try { if (backendEnabled) await deleteBackendLocation(id); setS(prev => { const next = { ...prev, locations: (prev.locations || []).filter(l => l.id !== id) }; if (!backendEnabled) saveSettings(next); return next; }); toast.success("تم حذف الموقع"); } catch (e) { console.error("تعذر حذف الموقع:", e); toast.error("تعذر حذف الموقع", userFacingError(e, "لم يتم حذف الموقع. حاول مرة أخرى.")); } finally { setDeletingLocationId(null); } };
  const getLocation = async (target: "main" | "new") => {
    try {
      const position = await getCurrentPosition();
      if (target === "main") {
        setS(prev => ({ ...prev, workSiteLat: position.lat, workSiteLng: position.lng }));
      } else {
        setLocLat(position.lat);
        setLocLng(position.lng);
      }
      const accuracyLabel = position.accuracy === undefined ? "غير معروفة" : String(position.accuracy) + "م";
      toast.success("تم تحديد الموقع بدقة", "دقة GPS المعلنة: " + accuracyLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحديد الموقع بدقة.";
      toast.error("تعذر تحديد الموقع بدقة", message);
    }
  };
  const setMainMapLocation = (lat: number, lng: number) => setS(prev => ({ ...prev, workSiteLat: lat, workSiteLng: lng }));
  const setEditorMapLocation = (lat: number, lng: number) => { setLocLat(lat); setLocLng(lng); };
  const generateQr = () => setS(prev => ({ ...prev, qrCode: `HADIR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}` }));
  const printQr = () => {
    const sheet = printRef.current;
    if (!sheet) {
      toast.error("تعذر تجهيز رمز QR للطباعة", "افتح قسم رمز الموقع ثم حاول مرة أخرى.");
      return;
    }

    const originalParent = sheet.parentElement;
    const originalNextSibling = sheet.nextSibling;
    if (!originalParent) {
      toast.error("تعذر تجهيز رمز QR للطباعة", "تعذر تحديد موضع بطاقة الطباعة.");
      return;
    }

    document.body.appendChild(sheet);

    const qrLogo = sheet.querySelector("svg image");
    if (qrLogo) {
      qrLogo.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    const style = document.createElement("style");
    style.id = "hadir-qr-print-style";
    style.textContent = "@page {\n  size: A4 portrait;\n  margin: 0;\n}\n\n@media print {\n  html,\n  body {\n    margin: 0 !important;\n    padding: 0 !important;\n    width: 100% !important;\n    min-width: 0 !important;\n    height: auto !important;\n    min-height: 0 !important;\n    overflow: hidden !important;\n    background: #fff !important;\n  }\n\n  body {\n    color: #111 !important;\n    font-family: 'Cairo', system-ui, sans-serif !important;\n  }\n\n  body > *:not(#hadir-qr-print-sheet) {\n    display: none !important;\n  }\n\n  #hadir-qr-print-sheet,\n  #hadir-qr-print-sheet * {\n    visibility: visible !important;\n  }\n\n  body > #hadir-qr-print-sheet {\n    position: relative !important;\n    width: 100% !important;\n    min-width: 0 !important;\n    max-width: none !important;\n    height: auto !important;\n    min-height: 0 !important;\n    max-height: none !important;\n    margin: 0 !important;\n    padding: 80mm 0 0 !important;\n    box-sizing: border-box !important;\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: stretch !important;\n    justify-content: flex-start !important;\n    overflow: hidden !important;\n    border: 0 !important;\n    border-radius: 0 !important;\n    box-shadow: none !important;\n    background: #fff !important;\n    color: #111 !important;\n    font-family: 'Cairo', system-ui, sans-serif !important;\n    text-align: center !important;\n    break-before: avoid !important;\n    break-after: avoid !important;\n    break-inside: avoid !important;\n    page-break-before: avoid !important;\n    page-break-after: avoid !important;\n    page-break-inside: avoid !important;\n  }\n\n  #hadir-qr-print-sheet > b {\n    display: block !important;\n    width: max-content !important;\n    height: auto !important;\n    margin: 0 auto 8mm !important;\n    padding: 0 !important;\n    font-family: 'Cairo', system-ui, sans-serif !important;\n    font-size: 24px !important;\n    line-height: 1.35 !important;\n    font-weight: 800 !important;\n    white-space: nowrap !important;\n  }\n\n  #hadir-qr-print-sheet > div {\n    display: block !important;\n    width: 122mm !important;\n    height: 122mm !important;\n    min-width: 122mm !important;\n    min-height: 122mm !important;\n    max-width: 122mm !important;\n    max-height: 122mm !important;\n    margin: 0 auto !important;\n    padding: 4mm !important;\n    box-sizing: border-box !important;\n    border: 3mm solid #16a34a !important;\n    border-radius: 8mm !important;\n    background: #fff !important;\n    box-shadow: 0 2mm 8mm rgba(22, 163, 74, 0.12) !important;\n    overflow: hidden !important;\n    flex: 0 0 122mm !important;\n    break-inside: avoid !important;\n    page-break-inside: avoid !important;\n  }\n\n  #hadir-qr-print-sheet > div > div {\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n  }\n\n  #hadir-qr-print-sheet svg {\n    width: 100% !important;\n    height: 100% !important;\n    display: block !important;\n  }\n\n  #hadir-qr-print-sheet > div > div > div {\n    width: 15mm !important;\n    height: 15mm !important;\n    border-radius: 4mm !important;\n    border-width: 2mm !important;\n    box-shadow: 0 1mm 4mm rgba(0, 0, 0, 0.18) !important;\n  }\n\n  #hadir-qr-print-sheet > div > div > div img {\n    width: 100% !important;\n    height: 100% !important;\n    object-fit: contain !important;\n  }\n\n  #hadir-qr-print-sheet > small {\n    display: block !important;\n    width: max-content !important;\n    height: auto !important;\n    margin: 2mm auto 0 !important;\n    padding: 0 !important;\n    font-family: 'Cairo', system-ui, sans-serif !important;\n    font-size: 15px !important;\n    line-height: 1.5 !important;\n    font-weight: 600 !important;\n    direction: ltr !important;\n    white-space: nowrap !important;\n  }\n}";
    document.head.appendChild(style);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      style.remove();

      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(sheet, originalNextSibling);
      } else {
        originalParent.appendChild(sheet);
      }
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  };
  const reset = () => { if (confirm("سيتم حذف بيانات النظام المحلية وإعادة التهيئة. هل أنت متأكد؟")) { resetAll(); setS(getSettings()); } };
  const resetCloudTestData = async () => { if (!isOwner || resettingCloud) return; const confirmation = window.prompt("هذه عملية Reset لبيانات النظام. اكتب: تأكيد"); if (confirmation !== "تأكيد") { if (confirmation !== null) setResetCloudResult("تم إلغاء العملية: كلمة التأكيد غير صحيحة."); return; } setResettingCloud(true); setResetCloudResult(null); try { const result = await resetBackendTestData(); resetAll(); setS(getSettings()); setResetCloudResult(result.message); } catch (e) { setResetCloudResult(e instanceof Error ? e.message : "تعذر تنفيذ Reset لبيانات الخادم."); } finally { setResettingCloud(false); } };
  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const section = (id: SettingsTab, children: React.ReactNode) => <div id={`settings-panel-${id}`} role="region" aria-labelledby="settings-content-title" tabIndex={activeTab === id ? 0 : -1} hidden={activeTab !== id} className={`settings-tab-panel ${activeTab === id ? "block" : "hidden"}`}>{children}</div>;
  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-settings-tab]");
    if (!button) return;
    const currentIndex = tabs.findIndex((tab) => tab.id === button.dataset.settingsTab);
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    document.getElementById(`settings-tab-${tabs[nextIndex].id}`)?.focus();
  };
  const returnToCategories = () => {
    setCategoryListOpen(true);
    window.setTimeout(() => {
      document.getElementById("settings-navigation")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector<HTMLButtonElement>(`[data-settings-tab="${activeTab}"]`)?.focus();
    }, 0);
  };

  return <ManagerLayout title="الإعدادات">
    <div ref={settingsRef} className="settings-page">
      <div className="settings-workspace">
        <aside id="settings-navigation" className="settings-navigation" aria-label="التنقل في الإعدادات" hidden={!categoryListOpen}>
          <div className="settings-navigation-heading"><span className="settings-eyebrow">تنظيم النظام</span><h2>اختر قسماً</h2></div>
          <nav className="settings-navigation-list" aria-label="أقسام الإعدادات" onKeyDown={handleCategoryKeyDown}>
            {tabs.map((tab) => <button key={tab.id} id={`settings-tab-${tab.id}`} type="button" data-settings-tab={tab.id} aria-controls={`settings-panel-${tab.id}`} aria-expanded={!categoryListOpen && activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setCategoryListOpen(false); window.setTimeout(() => { const header = document.getElementById("settings-content-header"); header?.scrollIntoView({ behavior: "smooth", block: "start" }); header?.focus(); }, 0); }} className="settings-nav-item">
              <span className="settings-nav-icon"><TabIcon type={tab.icon} /></span>
              <span className="settings-nav-copy"><span className="settings-nav-code">{tab.code}</span><span className="settings-nav-label">{tab.label}</span><span className="settings-nav-hint">{tab.hint}</span></span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-nav-chevron" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>)}
          </nav>
          <div className="settings-navigation-note"><span className="settings-navigation-note__icon">i</span><span>تُحفظ إعدادات النظام من الزر الثابت أسفل الشاشة. بعض الأقسام لها إجراءات حفظ مستقلة.</span></div>
        </aside>

        <section className="settings-content" aria-label="محتوى الإعدادات" hidden={categoryListOpen}>
          <header id="settings-content-header" tabIndex={-1} className="settings-content-header">
            <div className="settings-content-title"><span className="settings-content-icon"><TabIcon type={activeTabInfo.icon} /></span><div><span className="settings-eyebrow">القسم {activeTabInfo.code} من {tabs.length}</span><h2 id="settings-content-title">{activeTabInfo.label}</h2><p>{activeTabInfo.hint}</p></div></div>
            <button type="button" className="settings-back-button" onClick={returnToCategories} aria-label="العودة إلى أقسام الإعدادات"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg><span>الأقسام</span></button>
          </header>
          <div className="settings-panels">
      {section("profile", <div className="space-y-6">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v14"/><path d="M4 18h16M8 8h8M8 12h5"/><circle cx="17" cy="16" r="2"/></svg></span><div><div className="text-[10px] font-black text-primary mono">01 · COMPANY PROFILE</div><h2 className="mt-0.5 text-lg font-black">الملف الشخصي للشركة</h2><p className="settings-card-description mt-1 text-xs text-muted-foreground">الهوية، التخصصات، المنطقة الزمنية والعطل الرسمية.</p></div></div>
            </div>
            <div className="company-specialties-host p-4 sm:p-6"><CompanySpecialtiesPanel /></div><style>{".company-specialties-host > details > summary{display:none!important}.company-specialties-host > details{border:0!important;background:transparent!important;box-shadow:none!important}"}</style>
          </div>
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><TabIcon type="clock" /></span><div><div className="text-[10px] font-black text-primary mono">COMPANY PROFILE · TIME</div><h2 className="mt-0.5 text-lg font-black">المنطقة الزمنية والعطل الرسمية</h2><p className="mt-1 text-xs text-muted-foreground">تُستخدم في الدوام والتقارير والعطل الرسمية.</p></div></div></div>
          <div className="space-y-4 p-4 sm:p-6">
            <Field label="ابحث عن منطقة أو مدينة"><input type="search" className="input mt-1" value={timezoneSearch} onChange={(event) => setTimezoneSearch(event.target.value)} placeholder="مثال: دمشق، Asia/Damascus، Tokyo أو Europe/Paris" /></Field>
            <Field label="اختر المنطقة الزمنية"><select className="input mt-1" value={isValidSystemTimeZone(s.timezone) ? s.timezone : DEFAULT_SYSTEM_TIME_ZONE} onChange={(event) => setS({ ...s, timezone: event.target.value })} aria-describedby="system-timezone-help">
              {filteredTimeZones.map((zone) => <option key={zone} value={zone}>{getTimeZoneOptionLabel(zone)}</option>)}
            </select></Field>
            <div id="system-timezone-help" className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-xs leading-6 text-muted-foreground"><span className="font-bold text-foreground">الإعداد الحالي:</span> {isValidSystemTimeZone(s.timezone) ? s.timezone : DEFAULT_SYSTEM_TIME_ZONE} · {getTimeZoneOffsetLabel(isValidSystemTimeZone(s.timezone) ? s.timezone : DEFAULT_SYSTEM_TIME_ZONE)}<br />اختر المنطقة التي يعتمد عليها النظام في الدوام والتقارير. احفظ التغيير لتطبيقه؛ لا تتغير السجلات السابقة.</div>
            <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
              <Field label="الدولة المعتمدة للعطل الرسمية">
                <select className="input mt-1" value={s.holidayCountry || ""} onChange={event => setS({ ...s, holidayCountry: event.target.value })}>
                  <option value="">بدون عطلات رسمية</option>
                  {holidayCountries.map(country => <option key={country.code} value={country.code}>{displayHolidayCountry(country)} · {country.code}</option>)}
                </select>
              </Field>
              <div className="mt-3 text-xs text-muted-foreground">يُحدّث تقويم الدولة تلقائياً مرة كل شهر.</div>
            </div>
          </div>
        </div>
        </div>
      </div>)}

      {section("locations", <div className="space-y-6">
        {showLocation ? <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
            <button type="button" aria-label="العودة إلى قائمة المواقع" title="رجوع" onClick={() => { resetLocationForm(); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div className="min-w-0 flex-1 text-right"><div className="text-[10px] font-black text-primary mono">LOCATION EDITOR</div><div className="truncate text-lg font-black">{editingLocationId ? "تعديل الموقع" : "إضافة موقع جديد"}</div><div className="mt-0.5 text-xs text-muted-foreground">احفظ نفس إعدادات الموقع الحالية دون تغيير أي من وظائف النظام.</div></div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <div className="space-y-4">
              <Field label="اسم الموقع"><input className="input mt-1" value={locName} onChange={e => setLocName(e.target.value)} placeholder="مثال: مفرزة الجامعة" /></Field>
              <LocationPicker lat={Number(locLat)} lng={Number(locLng)} radiusMeters={Number(locRadius)} onChange={setEditorMapLocation} />
              <div className="grid gap-3 md:grid-cols-3"><Field label="خط العرض"><input className="input mono mt-1" value={locLat} onChange={e => setLocLat(+e.target.value)} /></Field><Field label="خط الطول"><input className="input mono mt-1" value={locLng} onChange={e => setLocLng(+e.target.value)} /></Field><Field label="نطاق التحقق بالمتر"><input className="input mono mt-1" value={locRadius} onChange={e => setLocRadius(+e.target.value)} /></Field></div>
              <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => getLocation("new")}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>تحديد GPS</button><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void saveLocation()} disabled={savingLocation}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/></svg>{savingLocation ? "جارٍ الحفظ…" : editingLocationId ? "حفظ التعديل" : "حفظ الموقع"}</button></div>
            </div>
          </div>
        </div> : selectedLocationId ? (() => {
          const selected = selectedLocationId === "main" ? { id: "main", name: "المقر الرئيسي", lat: Number(s.workSiteLat), lng: Number(s.workSiteLng), radiusMeters: Number(s.radiusMeters) } : (s.locations || []).find(location => location.id === selectedLocationId);
          if (!selected) return null;
          const isMain = selected.id === "main";
          return <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
              <button type="button" aria-label="العودة إلى قائمة المواقع" title="رجوع" onClick={() => setSelectedLocationId(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><SectionIcon type="locations" /></div>
              <div className="min-w-0 flex-1 text-right"><div className="text-[10px] font-black text-primary mono">{isMain ? "MAIN LOCATION" : "WORK SITE"}</div><div className="truncate text-lg font-black">{selected.name}</div><div className="mt-0.5 text-xs text-muted-foreground">تفاصيل الموقع ونطاق التحقق الجغرافي</div></div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/60 px-4 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><SectionIcon type="locations" /></span><div><div className="text-sm font-black">{selected.name}</div><div className="mt-0.5 text-[10px] text-muted-foreground mono">{isMain ? "MAIN" : selected.id}</div></div></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">نطاق {Number(selected.radiusMeters)}م</span></div></div>
              <div className="space-y-4 p-4 sm:p-6">
                <LocationPicker lat={Number(selected.lat)} lng={Number(selected.lng)} radiusMeters={Number(selected.radiusMeters)} onChange={(lat, lng) => { if (isMain) setMainMapLocation(lat, lng); else setS(prev => ({ ...prev, locations: (prev.locations || []).map(location => location.id === selected.id ? { ...location, lat, lng } : location) })); }} />
                <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="text-[10px] text-muted-foreground">خط العرض</div><div className="mt-1 font-black mono text-sm">{Number(selected.lat).toFixed(7)}</div></div><div className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="text-[10px] text-muted-foreground">خط الطول</div><div className="mt-1 font-black mono text-sm">{Number(selected.lng).toFixed(7)}</div></div><div className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="text-[10px] text-muted-foreground">نطاق التحقق</div><div className="mt-1 font-black mono text-sm">{Number(selected.radiusMeters)} متر</div></div></div>
                {isMain ? <div className="grid gap-3 md:grid-cols-3"><Field label="خط العرض"><input type="number" step="0.0000001" className="input mono mt-1" value={s.workSiteLat} onChange={e => setS({ ...s, workSiteLat: +e.target.value })} /></Field><Field label="خط الطول"><input type="number" step="0.0000001" className="input mono mt-1" value={s.workSiteLng} onChange={e => setS({ ...s, workSiteLng: +e.target.value })} /></Field><Field label="نطاق التحقق بالمتر"><input type="number" min="20" max="2000" className="input mono mt-1" value={s.radiusMeters} onChange={e => setS({ ...s, radiusMeters: +e.target.value })} /></Field></div> : null}
                <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => getLocation(isMain ? "main" : "new")}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>استخدام موقعي الحالي</button>{isMain ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void save()} disabled={savingSettings}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/></svg>{savingSettings ? "جارٍ الحفظ…" : "حفظ الموقع الرئيسي"}</button> : <><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => startEditLocation(selected)}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 16-.8 3.8L7 19l10.5-10.5-3-3z"/><path d="m13 6 3 3"/></svg>تعديل الموقع</button><button type="button" className="btn-secondary inline-flex items-center gap-2 text-destructive" onClick={() => { void removeLocation(selected.id); setSelectedLocationId(null); }} disabled={deletingLocationId === selected.id}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>{deletingLocationId === selected.id ? "جارٍ الحذف…" : "حذف الموقع"}</button></>}</div>
              </div>
            </div>
          </div>;
        })() : <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="locations" /></span><div><div className="text-[10px] font-black text-primary mono">03 · WORK SITES</div><h2 className="mt-0.5 text-lg font-black">المقر والفروع</h2><p className="mt-1 text-xs text-muted-foreground">افتح أي موقع لمراجعة إحداثياته ونطاق التحقق وتحديثها.</p></div></div><span className="hidden rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold text-primary sm:inline-flex">{extraLocations.length + 1} مواقع مسجلة</span></div></div>
            <div className="divide-y divide-border/60">
              {[{ id: "main", name: "المقر الرئيسي", lat: Number(s.workSiteLat), lng: Number(s.workSiteLng), radiusMeters: Number(s.radiusMeters) }, ...extraLocations].map(location => <button key={location.id} type="button" onClick={() => setSelectedLocationId(location.id)} className="group flex w-full items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-primary/5 sm:px-6 sm:py-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="locations" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-black">{location.name}</span>{location.id === "main" && <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black text-primary mono">MAIN</span>}</span><span className="mt-1 block text-[10px] text-muted-foreground">{Number(location.lat).toFixed(6)} · {Number(location.lng).toFixed(6)} · نطاق {Number(location.radiusMeters)}م</span></span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>)}
            </div>
          </div>
          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] px-4 py-4 text-sm font-black text-primary transition-colors hover:bg-primary/10" onClick={() => { setEditingLocationId(null); setShowLocation(true); setLocName(""); setLocLat(s.workSiteLat); setLocLng(s.workSiteLng); setLocRadius(s.radiusMeters); }}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>إضافة موقع عمل جديد</button>
          <div data-hadir-qr-settings className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="qr" /></span><div><div className="text-[10px] font-black text-primary mono">04 · QR ACCESS</div><h2 className="mt-0.5 text-lg font-black">رمز التحقق للحضور</h2><p className="mt-1 text-xs text-muted-foreground">تجديد رمز الحضور والانصراف أو طباعته للاستخدام في الموقع.</p></div></div></div>
            <div className="space-y-5 p-5 sm:p-6">
              <div><div className="text-sm font-black">رمز الموقع الحالي</div><p className="mt-1 text-xs leading-6 text-muted-foreground">يمكنك تغيير الرمز أو طباعته مع الحفاظ على نفس آلية التحقق الحالية.</p></div>
              <div id="hadir-qr-print-sheet" ref={printRef} className="mx-auto w-full max-w-[430px] rounded-3xl border border-border/70 bg-white p-5 text-center text-black shadow-sm sm:p-6">
                <b className="block text-xl mb-3">{s.brandName || "حاضِر"}</b>
                <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 p-2 rounded-2xl border-[3mm] border-green-600 bg-white shadow-[0_8px_24px_rgba(22,163,74,.12)]">
                  <div className="relative w-full h-full overflow-hidden">
                    <QRCodeSVG value={s.qrCode || loginUrl} size={700} level="H" includeMargin bgColor="#ffffff" fgColor="#111111" className="block w-full h-full" aria-label="QR" imageSettings={{ src: s.brandLogo || PROJECT_LOGO, width: 64, height: 64, excavate: true }} />
                  </div>
                </div>
                <small className="block mt-3 font-mono">{s.qrCode || loginUrl}</small>
              </div>
              <div className="flex flex-wrap justify-center gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={generateQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM20 17v3h-3M17 20h3"/></svg>توليد رمز جديد</button><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={printQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v6H6z"/></svg>طباعة الرمز</button></div>
            </div>
          </div>

        </div>}
      </div>)}

      {section("security", <div className="space-y-6">
                  <div className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M19 4h3v3"/></svg></span><div><div className="text-[10px] font-black text-primary mono">01 · ACCESS</div><h2 className="mt-0.5 text-lg font-black">حسابات الإدارة</h2><p className="settings-card-description mt-1 text-xs text-muted-foreground">المديرون والمشرفون وصلاحيات الوصول.</p></div></div></div>
            <div className="p-4 sm:p-6"><AdminAccountsPanel /></div>
          </div>

        <div className="rounded-3xl border border-border/70 bg-card shadow-sm"><div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M16 4h5v5"/></svg></span><div><div className="text-[10px] font-black text-primary mono">03 · OWNER</div><h2 className="mt-0.5 text-lg font-black">بيانات مالك النظام</h2><p className="mt-1 text-xs text-muted-foreground">تحديث اسم المستخدم وكلمة المرور الخاصة بحساب المالك.</p></div></div></div><div className="p-4 sm:p-6"><div className="grid gap-4 md:grid-cols-3"><Field label="اسم المالك"><input className="input mt-1" value={s.ownerName || ""} onChange={e => setS({ ...s, ownerName: e.target.value })} placeholder="اسم المالك" /></Field><Field label="اسم المستخدم"><input className="input mono mt-1" value={s.ownerUsername || ""} onChange={e => setS({ ...s, ownerUsername: e.target.value })} placeholder="اسم المستخدم" /></Field><Field label="كلمة مرور جديدة"><input type="password" className="input mt-1" value={password} onChange={e => setPassword(e.target.value)} placeholder="12 محرفًا على الأقل" /></Field></div><div className="mt-4 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">يتم تطبيق بيانات المالك من خلال مسار الحفظ المركزي نفسه؛ لن يتم تعديل الحساب بمجرد الكتابة.</div></div></div>
        {isOwner && <div className="rounded-3xl border border-border/70 bg-card shadow-sm"><div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 15v5M15.5 17.5h5"/></svg></span><div><div className="text-[10px] font-black text-primary mono">03 · BULK OPERATIONS</div><h2 className="mt-0.5 text-lg font-black">ضوابط الموظفين الجماعية</h2><p className="mt-1 text-xs text-muted-foreground">تطبيق إعدادات الدوام والحسابات على مجموعة الموظفين.</p></div></div></div><div className="p-4 sm:p-6"><OwnerBulkSettingsPanel /></div></div>}
      </div>)}

      {section("advanced", <div className="space-y-6">
        {isOwner && <div className="rounded-3xl border border-border/70 bg-card shadow-sm"><div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="diagnostics" /></span><div><div className="text-[10px] font-black text-primary mono">05 · SYSTEM HEALTH</div><h2 className="mt-0.5 text-lg font-black">سجل التشخيص</h2><p className="mt-1 text-xs text-muted-foreground">استعراض الأخطاء المسجلة وفتح تفاصيلها أو تنظيف السجل.</p></div></div><span className="rounded-full border border-border/70 bg-muted px-2.5 py-1 text-[10px] font-black mono">{getDiagnostics().filter(x => x.level === "error").length} ERRORS</span></div></div><div className="p-4 sm:p-6"><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => { setDiagnostics(getDiagnostics()); setShowDiagnostics(true); }}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><path d="m9.5 12 1.7 1.7 3.5-3.5"/></svg>فتح سجل التشخيص</button><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => { clearDiagnostics(); setDiagnostics([]); }}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7v13h10V7"/><path d="M10 11v5M14 11v5"/></svg>مسح السجل</button></div>{showDiagnostics && <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3 max-h-[520px] overflow-auto">{diagnostics.length === 0 ? <div className="p-4 text-sm text-muted-foreground">لا توجد أخطاء مسجلة.</div> : diagnostics.map(d => <details key={d.id} className="rounded-xl border border-border/70 bg-background p-3"><summary className="cursor-pointer text-sm"><b>{d.code}</b> · {new Date(d.timestamp).toLocaleString("ar-SA", { timeZone: getSystemTimeZone() })} · {d.message}</summary><pre className="mt-3 whitespace-pre-wrap break-words text-[11px] mono overflow-auto">{JSON.stringify({ level: d.level, code: d.code, timestamp: d.timestamp, message: d.message, stack: d.stack, context: d.context }, null, 2)}</pre></details>)}</div>}</div></div>}
        {isOwner && <div className="overflow-hidden rounded-3xl border border-destructive/30 bg-card shadow-sm"><div className="border-b border-destructive/20 bg-destructive/[0.045] px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"><SectionIcon type="danger" /></span><div><div className="text-[10px] font-black text-destructive mono">06 · DANGER ZONE</div><h2 className="mt-0.5 text-lg font-black">إعادة ضبط بيانات السحابة</h2><p className="mt-1 text-xs text-muted-foreground">إجراء تدميري مستقل ومقيد بالمالك.</p></div></div></div><div className="p-4 sm:p-6"><p className="mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">يحذف بيانات التشغيل والاختبار من D1 وR2، مع إبقاء حسابات الإدارة والإعدادات الأساسية.</p><button type="button" className="btn-secondary inline-flex items-center gap-2 border-destructive/40 text-destructive" disabled={resettingCloud} onClick={() => void resetCloudTestData()}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></svg>{resettingCloud ? "جارٍ التنفيذ…" : "إعادة تهيئة النظام"}</button>{resetCloudResult && <div className="mt-4 rounded-2xl border border-border/70 bg-background p-4 text-sm">{resetCloudResult}</div>}</div></div>}
        <div className="overflow-hidden rounded-3xl border border-destructive/30 bg-card shadow-sm"><div className="border-b border-destructive/20 bg-destructive/[0.045] px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive"><SectionIcon type="danger" /></span><div><div className="text-[10px] font-black text-destructive mono">07 · LOCAL RESET</div><h2 className="mt-0.5 text-lg font-black">إعادة ضبط البيانات المحلية</h2><p className="mt-1 text-xs text-muted-foreground">إعادة تهيئة بيانات النظام المحلية عند الحاجة.</p></div></div></div><div className="p-4 sm:p-6"><p className="mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">هذا الإجراء يستبدل بيانات النظام المحلية بإعدادات التهيئة الافتراضية. لن يتم تنفيذه إلا بعد تأكيدك.</p><button type="button" className="btn-danger inline-flex items-center gap-2" onClick={reset}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></svg>إعادة تعيين البيانات</button></div></div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">ملاحظة:</span> الأدوات المتقدمة لا تظهر إلا للمالك، بينما تبقى الوظائف الأساسية مستقلة عن هذه المنطقة.</div>
      </div>)}

        </div>
      </section>
    </div>
      {error && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3.5 20h17L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg><span>{error}</span></div>}
    </div>

    <div hidden={categoryListOpen} className="settings-save-bar border-t border-border/70 bg-background/95 px-3 py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur-xl sm:px-6"><div className="settings-save-bar__inner"><div className="settings-save-bar__copy"><div className="text-xs font-black">تغييرات الإعدادات</div><div className="text-[10px] text-muted-foreground">احفظ التعديلات لتطبيقها على النظام.</div></div><div className="settings-save-bar__actions">{saved && <span className="settings-saved-status">تم الحفظ ✓</span>}<button type="button" className="btn-primary settings-save-button" onClick={() => void save()} disabled={savingSettings}>{savingSettings ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button></div></div></div>
  </ManagerLayout>;
}
