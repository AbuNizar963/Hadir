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
# Never replace an existing production panel. Only create it if it is genuinely absent.
if not panel.exists():
    raise SystemExit("CompanySpecialtiesPanel.tsx is missing; refusing to recreate production UI from a compatibility script")

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

# Employee editor: keep the existing form and employee data model, but make the
# work-type select consume centrally stored company specialties. Existing employee
# values are intentionally retained as a fallback option so deleting a specialty
# from settings never erases an employee's historical value.
p = ROOT / "src/pages/ManagerEmployees.tsx"
s = p.read_text(encoding="utf-8")
if "getBackendSettings" not in s:
    marker = "  getBackendLocations,"
    if marker not in s:
        raise SystemExit("backend import marker missing")
    s = s.replace(marker, "  getBackendLocations,\n  getBackendSettings,", 1)

old_select = '''function CompanySpecialtySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = getSettings().specialties || [];
  const current = value.trim();
  const merged = current && !options.includes(current) ? [current, ...options] : options;
  return <select value={current} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"><option value="">اختر نوع العمل</option>{merged.map(item => <option key={item} value={item}>{item}</option>)}</select>;
}'''
new_select = '''function CompanySpecialtySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [options, setOptions] = useState<string[]>(() => getSettings().specialties || []);
  const current = value.trim();
  useEffect(() => {
    let alive = true;
    getBackendSettings().then(remote => {
      const remoteItems = Array.isArray(remote?.specialties) ? remote.specialties.map(String).map(x => x.trim()).filter(Boolean) : [];
      if (alive && remoteItems.length) setOptions(Array.from(new Set(remoteItems)));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const merged = current && !options.includes(current) ? [current, ...options] : options;
  return <select value={current} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"><option value="">اختر نوع العمل</option>{merged.map(item => <option key={item} value={item}>{item}</option>)}</select>;
}'''
if old_select in s:
    s = s.replace(old_select, new_select, 1)
elif "function CompanySpecialtySelect" not in s:
    raise SystemExit("CompanySpecialtySelect is missing; refusing unsafe patch")

# The workflow must never overwrite a complete production employee page. It only
# performs the exact compatibility transformation above when the old selector is present.
p.write_text(s, encoding="utf-8")

# Daily report branding: remove the known hard-coded template title only when its
# exact current markup is present. Never replace a different production layout.
p = ROOT / "src/pages/ManagerReports.tsx"
s = p.read_text(encoding="utf-8")
old = '<h1 className="text-xl md:text-2xl font-black">خدمة قسم شرطة الشهباء لتاريخ {formatDate(date)}</h1>'
new = '<div className="flex flex-col items-center gap-2">{settings.brandLogo && <img src={settings.brandLogo} alt="شعار الشركة" className="h-14 w-auto max-w-[180px] object-contain" />}<h1 className="text-xl md:text-2xl font-black">{settings.brandName || "خدمة الدوام اليومية"}</h1><div className="text-sm font-bold">خدمة الدوام اليومية · {formatDate(date)}</div></div>'
if old in s:
    s = s.replace(old, new, 1)
elif "خدمة قسم شرطة الشهباء" in s:
    raise SystemExit("Hard-coded daily report title exists but expected markup differs; refusing unsafe patch")
p.write_text(s, encoding="utf-8")

print("company specialties compatibility patch complete")
