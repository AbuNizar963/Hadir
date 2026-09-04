import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings Telegram screen: ${message}; refusing unsafe replacement.`); };

// This patch follows the reference video literally:
// 1) Settings home keeps the company identity (logo + company name).
// 2) The settings categories are listed below it.
// 3) Tapping a category opens a viewport-level, full-screen detail screen.
// 4) The detail screen has one back icon + one title, then the existing controls.
// 5) Existing settings functionality is preserved; this patch only changes presentation/navigation.

const heroStart = source.indexOf('      <section className="mb-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">');
const heroEnd = source.indexOf('\n      {settingsHome ?', heroStart);
if (heroStart < 0 || heroEnd < 0) fail("settings identity hero anchors not found");

const identityHero = source.slice(heroStart, heroEnd);
source = source.slice(0, heroStart) + source.slice(heroEnd + 1);

const homeMarker = '      {settingsHome ? <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm" aria-label="قائمة أقسام الإعدادات">';
const homeStart = source.indexOf(homeMarker);
const homeEnd = source.indexOf('      </section> : <section className="space-y-4">', homeStart);
if (homeStart < 0 || homeEnd < 0) fail("settings home anchors not found");

const homeBlock = `      {settingsHome ? <div className="space-y-4">
${identityHero}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm" aria-label="قائمة أقسام الإعدادات">
        <div className="px-5 pb-4 pt-5 text-right sm:px-6"><div className="text-xl font-black tracking-tight">الإعدادات</div></div>
        <div className="divide-y divide-border/60">{tabs.map(tab => { const iconType = tab.id === "general" ? "profile" : tab.id === "locations" ? "locations" : tab.id === "security" ? "accounts" : "diagnostics"; return <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSettingsHome(false); }} className="group flex min-h-[72px] w-full items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-primary/5 active:bg-primary/10 sm:px-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type={iconType} /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold">{tab.label}</span></span><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>; })}</div>
      </section>
      </div> : <section className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-background" aria-label="إعدادات القسم">`;
source = source.slice(0, homeStart) + homeBlock + source.slice(homeEnd + '      </section> : <section className="space-y-4">'.length);

const detailHeaderOld = `        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
          <button type="button" aria-label="العودة إلى أقسام الإعدادات" title="رجوع" onClick={() => setSettingsHome(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6 6 6-6"/></svg></button>
          <div className="min-w-0 flex-1 text-right"><div className="text-[10px] font-black text-muted-foreground">الإعدادات</div><div className="truncate text-lg font-black">{tabs.find(tab => tab.id === activeTab)?.hint || "إعدادات القسم"}</div></div>
        </div>`;
const detailHeaderAlt = `        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="العودة إلى الإعدادات" title="رجوع" onClick={() => setSettingsHome(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-muted active:bg-muted/80">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="min-w-0 flex-1 text-right"><h1 className="truncate text-xl font-black">{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}</h1></div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-28 sm:px-6 sm:py-6">`;

if (source.includes(detailHeaderOld)) {
  source = source.replace(detailHeaderOld, detailHeaderAlt);
} else {
  const detailHeaderRegex = /        <div className="flex items-center gap-3 rounded-2xl border border-border\/70 bg-card px-4 py-3 shadow-sm">[\s\S]*?<\/div>\n        <div className="min-w-0">/;
  if (!detailHeaderRegex.test(source)) fail("detail header anchor not found");
  source = source.replace(detailHeaderRegex, detailHeaderAlt);
}

// The earlier Telegram navigation patch already owns the conditional's closing tags.
// Do not inject another </div></section>} here; doing so creates an invalid JSX tree.

// Keep the existing specialty controls intact while removing their nested duplicate chrome.
const host = '<div className="p-4 sm:p-6"><CompanySpecialtiesPanel /></div>';
if (source.includes(host)) {
  source = source.replace(
    host,
    '<div className="company-specialties-host p-4 sm:p-6"><CompanySpecialtiesPanel /></div><style>{".company-specialties-host > details > summary,.company-specialties-host > details > div > div:first-child{display:none!important}.company-specialties-host > details{border:0!important;background:transparent!important;box-shadow:none!important}"}</style>'
  );
}

writeFileSync(file, source, "utf8");
console.log("ManagerSettings: Telegram-style navigation applied; home keeps company identity and detail opens full-screen.");
