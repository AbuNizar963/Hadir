import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings Telegram screen: ${message}; refusing unsafe replacement.`); };

// The Telegram reference is a screen-level navigation pattern: no profile/brand hero,
// one page title, one label per row, one icon per row, and a dedicated detail screen.
const homeMarker = '      {settingsHome ? <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm" aria-label="قائمة أقسام الإعدادات">';
const heroStart = source.indexOf('      <section className="mb-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">');
const heroEnd = source.indexOf('\n      {settingsHome ?', heroStart);
if (heroStart < 0 || heroEnd < 0) fail("settings identity hero anchors not found");
source = source.slice(0, heroStart) + source.slice(heroEnd + 1);

const homeStart = source.indexOf(homeMarker);
const homeEnd = source.indexOf('      </section> : <section className="space-y-4">', homeStart);
if (homeStart < 0 || homeEnd < 0) fail("settings home anchors not found");
const homeBlock = `      {settingsHome ? <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm" aria-label="قائمة أقسام الإعدادات">\n        <div className="px-5 pb-4 pt-5 text-right sm:px-6"><div className="text-xl font-black tracking-tight">الإعدادات</div></div>\n        <div className="divide-y divide-border/60">{tabs.map(tab => { const iconType = tab.id === "general" ? "profile" : tab.id === "locations" ? "locations" : tab.id === "security" ? "accounts" : "diagnostics"; return <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSettingsHome(false); }} className="group flex min-h-[72px] w-full items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-primary/5 active:bg-primary/10 sm:px-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type={iconType} /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold">{tab.label}</span></span><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>; })}</div>\n      </section> : <section className="space-y-4">`;
source = source.slice(0, homeStart) + homeBlock + source.slice(homeEnd + '      </section> : <section className="space-y-4">'.length);

const detailHeaderOld = `        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">\n          <button type="button" aria-label="العودة إلى أقسام الإعدادات" title="رجوع" onClick={() => setSettingsHome(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6 6 6-6"/></svg></button>\n          <div className="min-w-0 flex-1 text-right"><div className="text-[10px] font-black text-muted-foreground">الإعدادات</div><div className="truncate text-lg font-black">{tabs.find(tab => tab.id === activeTab)?.hint || "إعدادات القسم"}</div></div>\n        </div>`;
const detailHeaderAlt = `        <div className="flex items-center gap-3 px-2 py-2">\n          <button type="button" aria-label="العودة إلى الإعدادات" title="رجوع" onClick={() => setSettingsHome(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-muted"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>\n          <div className="min-w-0 flex-1 text-right"><div className="truncate text-xl font-black">{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}</div></div>\n        </div>`;
if (source.includes(detailHeaderOld)) {
  source = source.replace(detailHeaderOld, detailHeaderAlt);
} else {
  const detailHeaderRegex = /        <div className="flex items-center gap-3 rounded-2xl border border-border\/70 bg-card px-4 py-3 shadow-sm">[\s\S]*?<\/div>\n        <div className="min-w-0">/;
  if (!detailHeaderRegex.test(source)) fail("detail header anchor not found");
  source = source.replace(detailHeaderRegex, `${detailHeaderAlt}\n        <div className="min-w-0">`);
}

// Remove the legacy generic "متقدم" wording if any earlier patch left it behind.
source = source.replace(/الْم?تقدم والتشخيص/g, "النظام والتشخيص");

writeFileSync(file, source, "utf8");
console.log("ManagerSettings: applied Telegram-style screen navigation with a single title/label per settings item.");
