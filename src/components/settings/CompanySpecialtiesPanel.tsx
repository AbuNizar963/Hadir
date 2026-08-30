import { useEffect, useState } from "react";
import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import type { Settings } from "@/types";
import { getSettings, saveSettings } from "@/lib/storage";
import { getBackendSettings, saveBackendSettings } from "@/lib/backend";

const clean = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));

export default function CompanySpecialtiesPanel() {
  const [items, setItems] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = getSettings().specialties || [];
      try {
        const remote = await getBackendSettings();
        const remoteItems = remote?.specialties || [];
        if (alive) setItems(clean(remoteItems.length ? remoteItems : local));
      } catch {
        if (alive) setItems(clean(local));
      }
    })();
    return () => { alive = false; };
  }, []);

  async function persist(next: string[]) {
    const normalized = clean(next);
    setItems(normalized);
    const nextSettings: Settings = { ...getSettings(), specialties: normalized };
    saveSettings(nextSettings);
    setSaving(true);
    setMessage(null);
    try {
      await saveBackendSettings(nextSettings);
      setMessage("تم حفظ التخصصات");
    } catch {
      setMessage("تم حفظها محليًا، وتعذر مزامنة الخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">تخصصات العمل</h2>
          <p className="mt-1 text-xs text-muted-foreground">قائمة غير محدودة لأنواع العمل التي يضيفها المالك وتظهر عند إضافة الموظفين وفي التقارير.</p>
          <div className="mt-4 flex gap-2">
            <input type="text" inputMode="text" autoCapitalize="none" autoCorrect="off" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = value.trim(); if (v && !items.includes(v)) { void persist([...items, v]); setValue(""); } } }} placeholder="مثال: سائق" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <button type="button" disabled={saving || !value.trim() || items.includes(value.trim())} onClick={() => { const v = value.trim(); if (v && !items.includes(v)) { void persist([...items, v]); setValue(""); } }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إضافة</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {items.length ? items.map(item => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">{item}<button type="button" onClick={() => void persist(items.filter(x => x !== item))} className="rounded-full p-0.5 text-muted-foreground hover:text-destructive" aria-label={`حذف ${item}`}><Trash2 className="h-3.5 w-3.5" /></button></span>) : <span className="text-xs text-muted-foreground">لم تتم إضافة تخصصات بعد.</span>}
          </div>
          {message && <p className="mt-3 text-[11px] text-muted-foreground">{message}</p>}
        </div>
      </div>
    </section>
  );
}
