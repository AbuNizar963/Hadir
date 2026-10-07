import { useEffect, useState } from "react";
import { BriefcaseBusiness, Building2, Check, ImagePlus, Pencil, Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import type { Settings } from "@/types";
import { getSettings } from "@/lib/storage";
import { getBackendSettings, saveBackendSettings } from "@/lib/backend";
import { setD1View } from "@/lib/d1View";
import { compressProfileImageDataUrl } from "@/lib/imageCompression";

const clean = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
const COMPANY_LOGO_API = `${String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "")}/api/company/logo`;

function currentCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.pathname === "/api/company/logo") {
      url.searchParams.set("v", String(Date.now()));
      return url.toString();
    }
  } catch {
    // Fall through to the server-provided URL.
  }
  return value;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("صيغة الشعار غير صالحة.");
  const mime = /^data:([^;]+);base64$/i.exec(dataUrl.slice(0, comma))?.[1] || "image/webp";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function adminToken() { return localStorage.getItem("hadir.api.token.admin") || ""; }

async function uploadCompanyLogo(dataUrl: string) {
  const form = new FormData();
  form.append("file", dataUrlToBlob(dataUrl), "company-logo.webp");
  const token = adminToken();
  const r = await fetch(COMPANY_LOGO_API, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include", cache: "no-store" });
  const d = await r.json().catch(() => ({})) as { url?: string; error?: string };
  if (!r.ok || typeof d.url !== "string") throw new Error(d.error || "تعذر حفظ شعار الشركة في R2.");
  return d.url;
}

async function deleteCompanyLogo() {
  const token = adminToken();
  const r = await fetch(COMPANY_LOGO_API, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : undefined, credentials: "include", cache: "no-store" });
  const d = await r.json().catch(() => ({})) as { error?: string };
  if (!r.ok) throw new Error(d.error || "تعذر إزالة الشعار من R2.");
}

export default function CompanySpecialtiesPanel() {
  const [items, setItems] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyRemoteSettings = (remote: Settings) => {
    setD1View({ settings: remote, locations: remote.locations || [], admins: remote.adminAccounts || [] });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = getSettings();
      if (alive) { setItems(clean(local.specialties || [])); setBrandName(local.brandName || ""); setBrandLogo(currentCompanyLogoUrl(local.brandLogo)); }
      try {
        const remote = await getBackendSettings();
        if (!alive) return;
        if (Array.isArray(remote?.specialties)) setItems(clean(remote.specialties));
        if (remote?.brandName !== undefined) setBrandName(String(remote.brandName || ""));
        if (remote?.brandLogo !== undefined) setBrandLogo(currentCompanyLogoUrl(remote.brandLogo));
        applyRemoteSettings(remote);
      } catch { if (alive) setMessage("تعذر تحميل الهوية المركزية، لم يتم تغيير البيانات المحلية."); }
      finally { if (alive) setHydrated(true); }
    })();
    return () => { alive = false; };
  }, []);

  async function persist(patch: Partial<Settings>) {
    if (saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      const current = getSettings();
      const next: Settings = { ...current, ...patch };
      if (patch.specialties) next.specialties = clean(patch.specialties);
      if (patch.brandName !== undefined) next.brandName = String(patch.brandName || "").trim();
      await saveBackendSettings(patch);
      const remote = await getBackendSettings();
      applyRemoteSettings(remote);
      setItems(clean(remote.specialties || []));
      setBrandName(remote.brandName || "");
      setBrandLogo(currentCompanyLogoUrl(remote.brandLogo));
      setMessage("تم الحفظ مركزيًا بنجاح");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر مزامنة الإعداد مع الخادم"); }
    finally { setSaving(false); }
  }

  async function handleLogo(file: File | undefined) {
    if (!file || saving || !hydrated) return;
    if (!file.type.startsWith("image/")) { setMessage("يرجى اختيار ملف صورة صالح."); return; }
    setSaving(true); setMessage(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر قراءة الصورة")); reader.onerror = () => reject(new Error("تعذر قراءة الصورة")); reader.readAsDataURL(file); });
      const compressed = await compressProfileImageDataUrl(raw, { maxWidth: 768, maxHeight: 768, quality: 0.84, type: "image/webp", maxBytes: 100 * 1024 });
      const uploadedUrl = await uploadCompanyLogo(compressed);
      setBrandLogo(uploadedUrl);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));
      try {
        const remote = await getBackendSettings();
        const refreshed = { ...remote, brandLogo: uploadedUrl } as Settings;
        applyRemoteSettings(refreshed);
        setBrandName(refreshed.brandName || "");
      } catch {
        // Keep the uploaded logo visible if the settings read is temporarily unavailable.
      }
      setMessage("تم تحديث الشعار تلقائيًا.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر حفظ الشعار"); }
    finally { setSaving(false); }
  }

  async function removeLogo() {
    if (saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      // R2 deletion is authoritative. Clear the UI immediately after the
      // successful DELETE and do not let a stale D1 response restore the old logo.
      await deleteCompanyLogo();
      setBrandLogo(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));

      try {
        const remote = await getBackendSettings();
        const refreshed = { ...remote, brandLogo: null } as Settings;
        applyRemoteSettings(refreshed);
        setBrandName(refreshed.brandName || "");
        setBrandLogo(null);
      } catch {
        // R2 deletion already succeeded; keep the logo removed locally even
        // if D1 is temporarily unavailable or still serving an older setting.
      }
      setMessage("تم حذف الشعار نهائيًا من R2 وتحديث الواجهة.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر إزالة الشعار"); }
    finally { setSaving(false); }
  }

  async function moveSpecialty(index: number, direction: -1 | 1) {
    const ni = index + direction; if (ni < 0 || ni >= items.length || saving) return;
    const next = [...items]; [next[index], next[ni]] = [next[ni], next[index]]; await persist({ specialties: next });
  }

  const add = () => { const v = value.trim(); if (v && !items.includes(v)) { void persist({ specialties: [...items, v] }); setValue(""); } };

  const displayedLogo = brandLogo;

  return (
    <details className="hud-card group overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg shadow-primary/5" open>
      <summary className="list-none cursor-pointer select-none border-b border-border/60 bg-primary/[0.04] px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Building2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold text-primary mono">IDENTITY · الهوية</span><span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">D1 + R2</span></div>
              <h2 className="mt-0.5 text-base font-black tracking-tight">هوية الشركة والجهة</h2>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">اسم وشعار الجهة والتخصصات المستخدمة عبر نظام حاضر.</p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>
      <div className="border-t-0 p-5 sm:p-7">
        <div className="space-y-4">
          <div className="space-y-4">
            <label className="block text-xs font-bold text-muted-foreground">اسم الشركة / الجهة<input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void persist({ brandName: brandName.trim() }); } }} maxLength={120} className="input mt-2 h-11 w-full rounded-xl" placeholder="مثال: شركة أو مؤسسة" /></label>
            <button type="button" disabled={saving || !hydrated || !brandName.trim()} onClick={() => void persist({ brandName: brandName.trim() })} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4"><Check className="h-4 w-4" />حفظ اسم الجهة</button>
            <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/50 p-3.5">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background shadow-inner">
                {displayedLogo ? <img src={displayedLogo} alt={brandName.trim() || "شعار الشركة"} className="h-full w-full object-contain p-2" /> : <ImagePlus className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />}
                <label className={`absolute bottom-1 left-1 grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground shadow-md ${saving || !hydrated ? "pointer-events-none opacity-50" : ""}`} title="تغيير الشعار" aria-label="تغيير الشعار">
                  <Pencil className="h-3.5 w-3.5" />
                  <input type="file" accept="image/*" className="sr-only" disabled={saving || !hydrated} onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void handleLogo(f); }} />
                </label>
                {brandLogo && <button type="button" disabled={saving || !hydrated} onClick={() => void removeLogo()} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-background/90 text-destructive shadow-md hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50" title="حذف الشعار" aria-label="حذف الشعار"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="min-w-0"><div className="text-sm font-black">شعار الشركة</div><div className="mt-1 text-xs text-muted-foreground">اضغط القلم لتغيير الصورة</div>{saving && <div className="mt-1 text-[11px] text-primary">جارٍ الحفظ…</div>}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-border/60 pt-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">تخصصات العمل</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">تُستخدم عند إضافة الموظفين وفي التقارير.</p><div className="mt-3 flex gap-2"><input type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="إضافة تخصص جديد" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><button type="button" disabled={saving || !hydrated || !value.trim() || items.includes(value.trim())} onClick={add} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إضافة</button></div><div className="mt-3 grid gap-2">{items.length === 0 ? <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">لا توجد تخصصات مضافة بعد.</div> : items.map((item, index) => <div key={item} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2"><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{index + 1}. {item}</span><button type="button" disabled={saving || !hydrated || index === 0} onClick={() => void moveSpecialty(index, -1)} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30" aria-label="رفع التخصص">↑</button><button type="button" disabled={saving || !hydrated || index === items.length - 1} onClick={() => void moveSpecialty(index, 1)} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30" aria-label="خفض التخصص">↓</button><button type="button" disabled={saving || !hydrated} onClick={() => void persist({ specialties: items.filter((_, i) => i !== index) })} className="rounded-lg border border-border p-1.5 text-destructive disabled:opacity-30" aria-label="حذف التخصص"><Trash2 className="h-4 w-4" /></button></div>)}</div></div></div></div>
      </div>
      {message && <div className="border-t border-border/60 bg-background/40 px-5 py-3 text-[11px] font-semibold text-muted-foreground sm:px-7">{message}</div>}
    </details>
  );
}
