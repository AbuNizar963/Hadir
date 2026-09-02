import { useEffect, useState } from "react";
import { BriefcaseBusiness, Building2, Check, ImagePlus, Plus, Trash2, GripVertical } from "lucide-react";
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = getSettings();
      if (alive) { setItems(clean(local.specialties || [])); setBrandName(local.brandName || ""); setBrandLogo(local.brandLogo || null); }
      try {
        const remote = await getBackendSettings();
        if (!alive) return;
        const merged = { ...getSettings(), ...remote } as Settings;
        if (Array.isArray(remote?.specialties)) setItems(clean(remote.specialties));
        if (remote?.brandName !== undefined) setBrandName(String(remote.brandName || ""));
        if (remote?.brandLogo !== undefined) setBrandLogo(remote.brandLogo || null);
        saveSettings(merged);
      } catch { if (alive) setMessage("تعذر تحميل الهوية المركزية، تم الاحتفاظ بالنسخة المحلية."); }
    })();
    return () => { alive = false; };
  }, []);

  async function persist(patch: Partial<Settings>) {
    setSaving(true); setMessage(null);
    const current = getSettings();
    const next: Settings = { ...current, ...patch };
    if (patch.specialties) next.specialties = clean(patch.specialties);
    if (patch.brandName !== undefined) next.brandName = String(patch.brandName || "").trim();
    if (patch.brandLogo !== undefined) next.brandLogo = patch.brandLogo || null;
    saveSettings(next); setItems(clean(next.specialties || [])); setBrandName(next.brandName || ""); setBrandLogo(next.brandLogo || null);
    try {
      const backendPatch: Partial<Settings> = { ...patch };
      if (patch.brandLogo === undefined) delete backendPatch.brandLogo;
      await saveBackendSettings(backendPatch);
      setMessage("تم الحفظ مركزيًا بنجاح");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر مزامنة الإعداد مع الخادم"); }
    finally { setSaving(false); }
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("يرجى اختيار ملف صورة صالح."); return; }
    setSaving(true); setMessage(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر قراءة الصورة")); reader.onerror = () => reject(new Error("تعذر قراءة الصورة")); reader.readAsDataURL(file); });
      const compressed = await compressProfileImageDataUrl(raw, { maxWidth: 768, maxHeight: 768, quality: 0.84, type: "image/webp", maxBytes: 100 * 1024 });
      const url = await uploadCompanyLogo(compressed);
      const next = { ...getSettings(), brandLogo: url } as Settings;
      saveSettings(next); setBrandLogo(url); setMessage("تم حفظ الشعار في R2 وربطه بسجل الهوية في D1.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر تجهيز الشعار"); }
    finally { setSaving(false); }
  }

  async function removeLogo() {
    setSaving(true); setMessage(null);
    try { await deleteCompanyLogo(); const next = { ...getSettings(), brandLogo: null } as Settings; saveSettings(next); setBrandLogo(null); setMessage("تم حذف الشعار من R2 وD1."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "تعذر إزالة الشعار"); }
    finally { setSaving(false); }
  }

  async function moveSpecialty(index: number, direction: -1 | 1) {
    const ni = index + direction; if (ni < 0 || ni >= items.length || saving) return;
    const next = [...items]; [next[index], next[ni]] = [next[ni], next[index]]; await persist({ specialties: next });
  }

  const add = () => { const v = value.trim(); if (v && !items.includes(v)) { void persist({ specialties: [...items, v] }); setValue(""); } };

  return (
    <section className="hud-card overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-0 shadow-lg shadow-primary/5">
      <div className="border-b border-border/60 bg-primary/[0.04] px-5 py-5 sm:px-7"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Building2 className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-black tracking-tight">هوية الشركة والجهة</h2><span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">هوية مركزية</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">اسم وشعار الجهة المستخدمان عبر واجهات حاضر والتقارير والمواد المطبوعة، مع حفظ مركزي في D1 وR2.</p></div></div></div>
      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-4"><label className="block text-xs font-bold text-muted-foreground">اسم الشركة / الجهة<input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void persist({ brandName: brandName.trim() }); } }} maxLength={120} className="input mt-2 h-11 w-full rounded-xl" placeholder="مثال: شركة أو مؤسسة" /></label><button type="button" disabled={saving || !brandName.trim()} onClick={() => void persist({ brandName: brandName.trim() })} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4"><Check className="h-4 w-4" />حفظ اسم الجهة</button><div className="rounded-2xl border border-border/70 bg-background/50 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background shadow-inner">{brandLogo ? <img src={brandLogo} alt={brandName.trim() || "شعار الشركة"} className="h-full w-full object-contain p-2" /> : <ImagePlus className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />}</div><div className="min-w-0 flex-1"><div className="text-sm font-black">الشعار الرسمي</div><div className="mt-1 text-[11px] leading-5 text-muted-foreground">يُضغط محليًا إلى WebP بحجم آمن ثم يُرفع إلى R2، ويُحفظ مفتاحه ومرجع العرض في D1.</div><div className="mt-3 flex flex-wrap gap-2"><label className="btn-secondary inline-flex cursor-pointer items-center gap-2 rounded-xl"><ImagePlus className="h-4 w-4" />{brandLogo ? "تغيير الشعار" : "رفع الشعار"}<input type="file" accept="image/*" className="sr-only" disabled={saving} onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void handleLogo(f); }} /></label>{brandLogo && <button type="button" disabled={saving} onClick={() => void removeLogo()} className="btn-secondary inline-flex items-center gap-2 rounded-xl text-destructive"><Trash2 className="h-4 w-4" />إزالة</button>}</div></div></div></div></div><div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><div className="text-xs font-black text-primary">حالة الهوية</div><div className="mt-3 space-y-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">اسم الجهة</span><span className="font-bold">{brandName.trim() ? "مضبوط" : "غير مضبوط"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">الشعار</span><span className="font-bold">{brandLogo ? "مرتبط بـ R2" : "غير مضاف"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">التخزين</span><span className="font-bold">D1 + R2</span></div></div></div></div>
      <div className="border-t border-border/60 p-5 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">تخصصات العمل</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">تُستخدم عند إضافة الموظفين وفي التقارير، ويمكن ترتيبها وحذفها دون التأثير على بيانات الموظفين الحالية.</p><div className="mt-4 flex gap-2"><input type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="إضافة تخصص جديد" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><button type="button" disabled={saving || !value.trim() || items.includes(value.trim())} onClick={add} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إضافة</button></div><div className="mt-4 grid gap-2">{items.length === 0 ? <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">لا توجد تخصصات مضافة بعد.</div> : items.map((item, index) => <div key={item} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2"><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{index + 1}. {item}</span><button type="button" disabled={saving || index === 0} onClick={() => void moveSpecialty(index, -1)} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30" aria-label="رفع التخصص">↑</button><button type="button" disabled={saving || index === items.length - 1} onClick={() => void moveSpecialty(index, 1)} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30" aria-label="خفض التخصص">↓</button><button type="button" disabled={saving} onClick={() => void persist({ specialties: items.filter((_, i) => i !== index) })} className="rounded-lg border border-border p-1.5 text-destructive disabled:opacity-30" aria-label="حذف التخصص"><Trash2 className="h-4 w-4" /></button></div>)}</div></div></div></div>
      {message && <div className="border-t border-border/60 bg-background/40 px-5 py-3 text-[11px] font-semibold text-muted-foreground sm:px-7">{message}</div>}
    </section>
  );
}
