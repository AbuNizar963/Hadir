import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings Telegram screen: ${message}; refusing unsafe replacement.`); };

// Important UX rule: the Settings entry/button itself stays in the normal manager UI.
// Only a category selected INSIDE Settings opens as a viewport-level screen.
// Existing settings controls and handlers are intentionally preserved.

if (!source.includes('import { useNavigate } from "react-router-dom";')) {
  const reactImport = /import \{ useEffect, useRef, useState \} from "react";\n/;
  if (!reactImport.test(source)) fail("React import anchor not found");
  source = source.replace(reactImport, 'import { useEffect, useRef, useState } from "react";\nimport { useNavigate } from "react-router-dom";\n');
}

if (!source.includes("const navigate = useNavigate();")) {
  const managerRegex = /(const manager = currentManager\(\);)/;
  if (!managerRegex.test(source)) fail("manager state anchor not found");
  source = source.replace(managerRegex, '$1 const navigate = useNavigate();');
}

// Track the settings category viewport so every category opens from its true top.
if (!source.includes("const settingsDetailRef = useRef<HTMLElement>(null);")) {
  const settingsHomeAnchor = '  const [settingsHome, setSettingsHome] = useState(true);';
  if (!source.includes(settingsHomeAnchor)) fail("settings home state anchor not found");
  source = source.replace(settingsHomeAnchor, `${settingsHomeAnchor}\n  const settingsDetailRef = useRef<HTMLElement>(null);\n  useEffect(() => { if (settingsHome) return; const frame = window.requestAnimationFrame(() => { settingsDetailRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }); window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }); return () => window.cancelAnimationFrame(frame); }, [settingsHome, activeTab]);`);
}

// The Settings home remains a normal in-page settings workspace. Do NOT make it fixed/fullscreen.
source = source.replace(
  '      {settingsHome ? <section className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-background" aria-label="الإعدادات">',
  '      {settingsHome ? <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm" aria-label="قائمة أقسام الإعدادات">'
);

// Only the selected category/detail screen is fixed, starting below both manager bars.
const detailOpen = '      </section> : <section className="space-y-4">';
if (!source.includes(detailOpen)) fail("settings detail opening anchor not found");
source = source.replace(
  detailOpen,
  '      </section> : <section ref={settingsDetailRef} className="settings-detail-screen fixed top-[138px] bottom-0 inset-x-0 z-[80] overflow-y-auto bg-background" aria-label="إعدادات القسم">'
);

// Remove the directional arrows from the Settings category list; the rows are clickable without them.
const categoryArrow = '<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
if (source.includes(categoryArrow)) source = source.replace(categoryArrow, '');

// Replace the compact detail chrome with a clean full-screen header: back + one title + X.
const detailHeaderRegex = /        <div className="flex items-center gap-3 rounded-2xl border border-border\/70 bg-card px-4 py-3 shadow-sm">[\s\S]*?<\/div>\n        <div className="min-w-0">/;
if (detailHeaderRegex.test(source)) {
  const detailHeader = `        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" aria-label="العودة إلى الإعدادات" title="رجوع" onClick={() => setSettingsHome(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-muted active:bg-muted/80">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <h1 className="truncate text-xl font-black">{tabs.find(tab => tab.id === activeTab)?.label || "الإعدادات"}</h1>
            </div>
            <button type="button" aria-label="العودة إلى قائمة الإعدادات" title="إغلاق" onClick={() => setSettingsHome(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border/70 bg-card text-foreground shadow-sm hover:bg-muted active:bg-muted/80">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
          </div>
        </header>
        <div className="settings-detail-content mx-auto w-full max-w-5xl px-4 py-4 pb-28 sm:px-6 sm:py-6">`;
  source = source.replace(detailHeaderRegex, detailHeader);
}

// Remove all accordion chevrons from the selected category, including nested settings panels.
// This is scoped to the settings detail screen so unrelated manager UI keeps its navigation icons.
const detailChevronCss = '<style>{".settings-detail-screen details > summary > svg{display:none!important}.settings-detail-screen .company-specialties-host > details > summary > svg{display:none!important}.settings-detail-screen [data-settings-accordion] > summary{padding-inline-end:1.25rem!important}.settings-detail-screen [data-settings-accordion] > summary > div:last-child{display:none!important}"}</style>';
if (!source.includes("settings-detail-screen details > summary > svg")) {
  const detailContentAnchor = '        <div className="settings-detail-content mx-auto w-full max-w-5xl px-4 py-4 pb-28 sm:px-6 sm:py-6">';
  if (!source.includes(detailContentAnchor)) fail("detail content anchor not found");
  source = source.replace(detailContentAnchor, `${detailContentAnchor}\n          ${detailChevronCss}`);
}

// Keep existing specialty controls intact while removing nested duplicate chrome if present.
const host = '<div className="p-4 sm:p-6"><CompanySpecialtiesPanel /></div>';
if (source.includes(host)) {
  source = source.replace(
    host,
    '<div className="company-specialties-host p-4 sm:p-6"><CompanySpecialtiesPanel /></div><style>{".company-specialties-host > details > summary,.company-specialties-host > details > div:first-child{display:none!important}.company-specialties-host > details{border:0!important;background:transparent!important;box-shadow:none!important}"}</style>'
  );
}

writeFileSync(file, source, "utf8");
console.log("ManagerSettings: category screens now start below both manager bars.");
