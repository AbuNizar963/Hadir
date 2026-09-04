import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings reset placement: ${message}; refusing unsafe replacement.`); };

const footerButton = '<button type="button" className="btn-danger text-xs" onClick={reset}>إعادة تعيين البيانات</button>';
if (!source.includes(footerButton)) fail("persistent reset button anchor not found");
source = source.replace(footerButton, "");

const advancedNote = '<div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">ملاحظة:</span> الأدوات المتقدمة لا تظهر إلا للمالك، بينما تبقى الوظائف الأساسية مستقلة عن هذه المنطقة.</div>';
if (!source.includes(advancedNote)) fail("advanced settings note anchor not found");

const resetCard = '<div className="overflow-hidden rounded-3xl border border-destructive/30 bg-card shadow-sm"><div className="border-b border-destructive/20 bg-destructive/[0.045] px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive"><SectionIcon type="danger" /></span><div><div className="text-[10px] font-black text-destructive mono">09 · LOCAL RESET</div><h2 className="mt-0.5 text-lg font-black">إعادة تعيين البيانات</h2><p className="mt-1 text-xs text-muted-foreground">إعادة تهيئة بيانات النظام المحلية عند الحاجة.</p></div></div></div><div className="p-4 sm:p-6"><p className="mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">هذا الإجراء يستبدل بيانات النظام المحلية بإعدادات التهيئة الافتراضية. لن يتم تنفيذه إلا بعد تأكيدك.</p><button type="button" className="btn-danger inline-flex items-center gap-2" onClick={reset}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></svg>إعادة تعيين البيانات</button></div></div>';
source = source.replace(advancedNote, `${resetCard}\n        ${advancedNote}`);

const requiredNavigationMarkers = [
  'const [settingsHome, setSettingsHome] = useState(true);',
  'onClick={() => { setActiveTab(tab.id); setSettingsHome(false); }}',
  'onClick={() => setSettingsHome(true)}',
  '{settingsHome ? <section',
  ': <section className="space-y-4">',
];
for (const marker of requiredNavigationMarkers) {
  if (!source.includes(marker)) fail(`dedicated settings navigation marker missing: ${marker}`);
}

const tabsAnchor = 'const tabs: Array<{ id: SettingsTab; label: string; hint: string }> = [\n  { id: "general", label: "عام", hint: "الهوية والحسابات" },\n  { id: "locations", label: "المواقع", hint: "المواقع و QR" },\n  { id: "security", label: "الأمان", hint: "المالك والعمليات" },\n  { id: "advanced", label: "متقدم", hint: "التشخيص وإعادة التهيئة" },\n];';
const professionalTabs = 'const tabs: Array<{ id: SettingsTab; label: string; hint: string }> = [\n  { id: "general", label: "الهوية والحسابات", hint: "هوية الشركة وحسابات الإدارة" },\n  { id: "locations", label: "المواقع و QR", hint: "مواقع العمل ورموز QR" },\n  { id: "security", label: "الأمان والصلاحيات", hint: "الحسابات والصلاحيات الإدارية" },\n  { id: "advanced", label: "النظام والتشخيص", hint: "التشخيص وإعادة التهيئة" },\n];';
if (!source.includes(tabsAnchor)) fail("settings tab naming anchor not found");
source = source.replace(tabsAnchor, professionalTabs);

const oldDetailTitle = '{tabs.find(tab => tab.id === activeTab)?.hint || "إعدادات القسم"}';
if (!source.includes(oldDetailTitle)) fail("duplicated detail title anchor not found");
source = source.replace(oldDetailTitle, '{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}');

const oldDetailEyebrow = '<div className="text-[10px] font-black text-muted-foreground">الإعدادات</div><div className="truncate text-lg font-black">{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}</div>';
const newDetailHeader = '<div className="truncate text-lg font-black">{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}</div>';
if (!source.includes(oldDetailEyebrow)) fail("duplicated detail eyebrow anchor not found");
source = source.replace(oldDetailEyebrow, newDetailHeader);

const oldHomeHeading = '<div className="border-b border-border/60 px-5 py-4 text-right"><div className="text-[10px] font-black text-muted-foreground">الإعدادات</div><div className="mt-1 text-lg font-black">اختر قسمًا لإدارة إعداداته</div></div>';
const newHomeHeading = '<div className="border-b border-border/60 px-5 py-4 text-right"><div className="text-lg font-black">الإعدادات</div><div className="mt-1 text-xs text-muted-foreground">اختر قسمًا لفتحه كواجهة مستقلة</div></div>';
if (!source.includes(oldHomeHeading)) fail("home heading anchor not found");
source = source.replace(oldHomeHeading, newHomeHeading);

writeFileSync(file, source, "utf8");
console.log("ManagerSettings: normalized Arabic-only category names, removed duplicate detail naming, and preserved Telegram-style dedicated views.");
