import { useEffect, useState } from "react";
import { BriefcaseBusiness, ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { Settings } from "@/types";
import { getSettings, saveSettings } from "@/lib/storage";
import { getBackendSettings, saveBackendSettings } from "@/lib/backend";
import { compressProfileImageDataUrl } from "@/lib/imageCompression";

const clean = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
const COMPANY_LOGO_API = `${String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "")}/api/company/logo`;

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("صيغة الشعار غير صالحة.");
  const mime = /^data:([^;]+);base64$/i.exec(dataUrl.slice(0, comma))?.[1] || "image/webp";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

async function uploadCompanyLogo(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("file", blob, "company-logo.webp");
  const token = localStorage.getItem("hadir.api.token.admin") || "";
  const response = await fetch(COMPANY_LOGO_API, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: unknown; url?: unknown };
  if (!response.ok || typeof data.url !== "string" || !data.url) throw new Error(typeof data.error === "string" ? data.error : "تعذر حفظ شعار الشركة في R2.");
  return data.url;
}

async function deleteCompanyLogo(): Promise<void> {
  const token = localStorage.getItem("hadir.api.token.admin") || "";
  const response = await fetch(COMPANY_LOGO_API, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : undefined, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر إزالة شعار الشركة من R2.");
}

export default function CompanySpecialtiesPanel() {
  const [items, setItems] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = getSettings();
      setItems(clean(local.specialties || []));
      setBrandName(local.brandName || "");
      setBrandLogo(local.brandLogo || null);
      try {
        const remote = await getBackendSettings();
        if (!alive) return;
        if (Array.isArray(remote?.specialties)) setItems(clean(remote.specialties));
        if (remote?.brandName !== undefined) setBrandName(String(remote.brandName || ""));
        if (remote?.brandLogo !== undefined) setBrandLogo(remote.brandLogo || null);
      } catch {
        // Keep the current local state when the server is temporarily unavailable.
      }
    })();
    return () => { alive = false; };
  }, []);

  async function persist(patch: Partial<Settings>) {
    const current = getSettings();
    const nextSettings: Settings = { ...current, ...patch };
    if (patch.specialties) {
      const normalized = clean(patch.specialties);
      nextSettings.specialties = normalized;
      setItems(normalized);
    }
    if (patch.brandName !== undefined) setBrandName(patch.brandName || "");
    if (patch.brandLogo !== undefined) setBrandLogo(patch.brandLogo || null);
    saveSettings(nextSettings);
    setSaving(true);
    setMessage(null);
    try {
      await saveBackendSettings(nextSettings);
      setMessage("تم حفظ البيانات مركزيًا");
    } catch {
      setMessage("تم حفظها محليًا، وتعذر مزامنة الخادم");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("يرجى اختيار ملف صورة صالح");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر قراءة الصورة"));
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
        reader.readAsDataURL(file);
      });
      const compressed = await compressProfileImageDataUrl(raw, { maxWidth: 512, maxHeight: 512, quality: 0.82, type: "image/webp", maxBytes: 100 * 1024 });
      const logoUrl = await uploadCompanyLogo(compressed);
      await persist({ brandLogo: logoUrl });
      setMessage("تم رفع الشعار وتخزينه في R2");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تجهيز الشعار");
      setSaving(false);
    }
  }

  async function removeLogo() {
    setSaving(true);
    setMessage(null);
    try {
      await deleteCompanyLogo();
      await persist({ brandLogo: null });
      setMessage("تم حذف الشعار من R2");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إزالة الشعار");
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm">
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">هوية الشركة / الجهة</h2>
            <p className="mt-1 text-xs text-muted-foreground">بيانات مركزية مستقلة عن الموظفين والحضور، وتستخدمها واجهات وتقارير النظام.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block text-xs text-muted-foreground">
                اسم الشركة / الجهة
                <input type="text" inputMode="text" autoCapitalize="words" autoCorrect="off" value={brandName} onChange={e => setBrandName(e.target.value)} className="input mt-1" placeholder="مثال: شركة أو مؤسسة" />
              </label>
              <button type="button" disabled={saving} onClick={() => void persist({ brandName: brandName.trim() })} className="btn-primary disabled:opacity-50">حفظ اسم الجهة</button>
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background">
                  {brandLogo ? <img src={brandLogo} alt={brandName.trim() || "شعار الشركة"} className="h-full w-full object-contain" /> : <span className="px-2 text-center text-[10px] text-muted-foreground">لا يوجد شعار</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">شعار الشركة / الجهة</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">تتم معالجة الصورة وضغطها بصيغة WebP ثم تخزينها بأمان في R2.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="btn-secondary inline-flex cursor-pointer items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      {brandLogo ? "تغيير الشعار" : "رفع الشعار"}
                      <input type="file" accept="image/*" className="sr-only" disabled={saving} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ""; void handleLogo(file); }} />
                    </label>
                    {brandLogo && <button type="button" disabled={saving} onClick={() => void removeLogo()} className="btn-secondary text-destructive disabled:opacity-50"><X className="mr-1 inline h-4 w-4" />إزالة الشعار</button>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black">تخصصات العمل</h2>
              <p className="mt-1 text-xs text-muted-foreground">قائمة غير محدودة لأنواع العمل التي يضيفها المالك وتظهر عند إضافة الموظفين وفي التقارير.</p>
              <div className="mt-4 flex gap-2">
                <input type="text" inputMode="text" autoCapitalize="none" autoCorrect="off" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = value.trim(); if (v && !items.includes(v)) { void persist({ specialties: [...items, v] }); setValue(""); } } }} placeholder="مثال: سائق" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <button type="button" disabled={saving || !value.trim() || items.includes(value.trim())} onClick={() => { const v = value.trim(); if (v && !items.includes(v)) { void persist({ specialties: [...items, v] }); setValue(""); } }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إضافة</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {items.length ? items.map(item => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">{item}<button type="button" disabled={saving} onClick={() => void persist({ specialties: items.filter(x => x !== item) })} className="rounded-full p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`حذف ${item}`}><Trash2 className="h-3.5 w-3.5" /></button></span>) : <span className="text-xs text-muted-foreground">لم تتم إضافة تخصصات بعد.</span>}
              </div>
            </div>
          </div>
        </div>
        {message && <p className="text-[11px] text-muted-foreground">{message}</p>}
      </div>
    </section>
  );
}
