import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings locations patch: ${message}; refusing unsafe replacement.`); };
const replaceOnce = (anchor, replacement, label) => {
  const index = source.indexOf(anchor);
  if (index < 0) fail(`${label} anchor not found`);
  source = source.slice(0, index) + replacement + source.slice(index + anchor.length);
};

if (!source.includes('const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);')) {
  replaceOnce(
    '  const [activeTab, setActiveTab] = useState<SettingsTab>("general");',
    '  const [activeTab, setActiveTab] = useState<SettingsTab>("general");\n  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);',
    "selected location state",
  );
}

const startMarker = '{section("locations",';
const endMarker = '{section("security",';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0 || end <= start) fail("locations section boundaries not found");

const replacement = String.raw`{section("locations", <div className="space-y-6">
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
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="locations" /></span><div><div className="text-[10px] font-black text-primary mono">03 · WORK SITES</div><h2 className="mt-0.5 text-lg font-black">مواقع العمل</h2><p className="mt-1 text-xs text-muted-foreground">اختر اسم الموقع لفتح خريطته وتفاصيله في واجهة مستقلة.</p></div></div><span className="hidden rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold text-primary sm:inline-flex">{(s.locations || []).length + 1} مواقع مسجلة</span></div></div>
            <div className="divide-y divide-border/60">
              {[{ id: "main", name: "المقر الرئيسي", lat: Number(s.workSiteLat), lng: Number(s.workSiteLng), radiusMeters: Number(s.radiusMeters) }, ...(s.locations || [])].map(location => <button key={location.id} type="button" onClick={() => setSelectedLocationId(location.id)} className="group flex w-full items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-primary/5 sm:px-6 sm:py-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="locations" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-black">{location.name}</span>{location.id === "main" && <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black text-primary mono">MAIN</span>}</span><span className="mt-1 block text-[10px] text-muted-foreground">{Number(location.lat).toFixed(6)} · {Number(location.lng).toFixed(6)} · نطاق {Number(location.radiusMeters)}م</span></span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>)}
            </div>
          </div>
          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] px-4 py-4 text-sm font-black text-primary transition-colors hover:bg-primary/10" onClick={() => { setEditingLocationId(null); setShowLocation(true); setLocName(""); setLocLat(s.workSiteLat); setLocLng(s.workSiteLng); setLocRadius(s.radiusMeters); }}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>إضافة موقع عمل جديد</button>
        </div>}
      </div>)}

      `;

source = source.slice(0, start) + replacement + source.slice(end);

writeFileSync(file, source, "utf8");
console.log("ManagerSettings locations patch: work sites now use a named list with dedicated map/detail views while preserving the existing editor and save/delete handlers.");
