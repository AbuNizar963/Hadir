from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / "src/types/index.ts"
s = p.read_text(encoding="utf-8")
if "specialties?: string[]; }" not in s:
    marker = "locations?: Location[]; }"
    if marker not in s:
        raise SystemExit("Settings type marker missing")
    p.write_text(s.replace(marker, "locations?: Location[]; specialties?: string[]; }", 1), encoding="utf-8")

panel = ROOT / "src/components/settings/CompanySpecialtiesPanel.tsx"
panel.parent.mkdir(parents=True, exist_ok=True)
panel.write_text('''import { useEffect, useState } from "react";\nimport { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";\nimport type { Settings } from "@/types";\nimport { getSettings, saveSettings } from "@/lib/storage";\nimport { getBackendSettings, saveBackendSettings } from "@/lib/backend";\n\nconst clean = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));\n\nexport default function CompanySpecialtiesPanel() {\n  const [items, setItems] = useState<string[]>([]);\n  const [value, setValue] = useState("");\n  const [saving, setSaving] = useState(false);\n  const [message, setMessage] = useState<string | null>(null);\n\n  useEffect(() => {\n    let alive = true;\n    (async () => {\n      const local = getSettings().specialties || [];\n      try {\n        const remote = await getBackendSettings();\n        const remoteItems = remote?.specialties || [];\n        if (alive) setItems(clean(remoteItems.length ? remoteItems : local));\n      } catch {\n        if (alive) setItems(clean(local));\n      }\n    })();\n    return () => { alive = false; };\n  }, []);\n\n  async function persist(next: string[]) {\n    const normalized = clean(next);\n    setItems(normalized);\n    const nextSettings: Settings = { ...getSettings(), specialties: normalized };\n    saveSettings(nextSettings);\n    setSaving(true);\n    setMessage(null);\n    try {\n      await saveBackendSettings(nextSettings);\n      setMessage("تم حفظ التخصصات");\n    } catch {\n      setMessage("تم حفظها محليًا، وتعذر مزامنة الخادم");\n    } finally {\n      setSaving(false);\n    }\n  }\n\n  return (\n    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm">\n      <div className="flex items-start gap-3">\n        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>\n        <div className="min-w-0 flex-1">\n          <h2 className="text-sm font-black">تخصصات العمل</h2>\n          <p className="mt-1 text-xs text-muted-foreground">قائمة غير محدودة لأنواع العمل التي يضيفها المالك وتظهر عند إضافة الموظفين وفي التقارير.</p>\n          <div className="mt-4 flex gap-2">\n            <input type="text" inputMode="text" autoCapitalize="none" autoCorrect="off" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = value.trim(); if (v && !items.includes(v)) { void persist([...items, v]); setValue(""); } } }} placeholder="مثال: سائق" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />\n            <button type="button" disabled={saving || !value.trim() || items.includes(value.trim())} onClick={() => { const v = value.trim(); if (v && !items.includes(v)) { void persist([...items, v]); setValue(""); } }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إضافة</button>\n          </div>\n          <div className="mt-4 flex flex-wrap gap-2">\n            {items.length ? items.map(item => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">{item}<button type="button" onClick={() => void persist(items.filter(x => x !== item))} className="rounded-full p-0.5 text-muted-foreground hover:text-destructive" aria-label={`حذف ${item}`}><Trash2 className="h-3.5 w-3.5" /></button></span>) : <span className="text-xs text-muted-foreground">لم تتم إضافة تخصصات بعد.</span>}\n          </div>\n          {message && <p className="mt-3 text-[11px] text-muted-foreground">{message}</p>}\n        </div>\n      </div>\n    </section>\n  );\n}\n''', encoding="utf-8")

p = ROOT / "src/pages/ManagerSettings.tsx"
s = p.read_text(encoding="utf-8")
if "CompanySpecialtiesPanel" not in s:
    imp = 'import ManagerLayout from "@/components/layout/ManagerLayout";'
    if imp not in s:
        raise SystemExit("ManagerLayout import missing")
    s = s.replace(imp, imp + '\nimport CompanySpecialtiesPanel from "@/components/settings/CompanySpecialtiesPanel";', 1)
    m = re.search(r"<ManagerLayout[^>]*>", s)
    if not m:
        raise SystemExit("ManagerLayout opening tag missing")
    s = s[:m.end()] + "\n      <CompanySpecialtiesPanel />" + s[m.end():]
    p.write_text(s, encoding="utf-8")

p = ROOT / "src/pages/ManagerEmployees.tsx"
s = p.read_text(encoding="utf-8")
if "CompanySpecialtySelect" not in s:
    imp = 'import { getEmployees, saveEmployees } from "@/lib/storage";'
    if imp not in s:
        raise SystemExit("storage import missing")
    s = s.replace(imp, 'import { getEmployees, saveEmployees, getSettings } from "@/lib/storage";', 1)
    marker = 'function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {'
    if marker not in s:
        raise SystemExit("Field marker missing")
    select = '''function CompanySpecialtySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {\n  const options = getSettings().specialties || [];\n  const current = value.trim();\n  const merged = current && !options.includes(current) ? [current, ...options] : options;\n  return <select value={current} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"><option value="">اختر نوع العمل</option>{merged.map(item => <option key={item} value={item}>{item}</option>)}</select>;\n}\n\n'''
    s = s.replace(marker, select + marker, 1)
    replacement = '<Field label="نوع العمل" hint="تؤخذ من تخصصات الشركة التي يضيفها المالك"><CompanySpecialtySelect value={form.specialties} onChange={v => setForm(prev => ({ ...prev, specialties: v }))} /></Field>'
    found = False
    for pat in [r'<Field label="التخصصات"[^>]*>.*?</Field>', r'<Field label="الاختصاص"[^>]*>.*?</Field>', r'<Field label="Specialties"[^>]*>.*?</Field>']:
        s2, n = re.subn(pat, replacement, s, count=1, flags=re.S)
        if n:
            s = s2
            found = True
            break
    if not found:
        raise SystemExit("Existing specialties Field not found; refusing unsafe patch")
    p.write_text(s, encoding="utf-8")

# Daily report: remove the hard-coded Excel/template organization name.
# The report keeps the Excel layout as a visual reference, but all group names now come from owner-managed specialties.
p = ROOT / "src/pages/ManagerReports.tsx"
s = p.read_text(encoding="utf-8")
old = '<h1 className="text-xl md:text-2xl font-black">خدمة قسم شرطة الشهباء لتاريخ {formatDate(date)}</h1>'
new = '<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>'
if old in s:
    s = s.replace(old, new, 1)
elif "خدمة قسم شرطة الشهباء" in s:
    raise SystemExit("Hard-coded daily report title exists but expected markup differs; refusing unsafe patch")
p.write_text(s, encoding="utf-8")

print("company specialties and daily report branding patch complete")
