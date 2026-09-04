import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings locations fixes: ${message}; refusing unsafe replacement.`); };
const replaceOnce = (anchor, replacement, label) => {
  const index = source.indexOf(anchor);
  if (index < 0) fail(`${label} anchor not found`);
  source = source.slice(0, index) + replacement + source.slice(index + anchor.length);
};

const extraLocations = 'const extraLocations = (s.locations || []).filter((location) => location.id !== "main");';
if (!source.includes(extraLocations)) {
  replaceOnce(
    'const manager = currentManager(); const isOwner = manager?.role === "owner" || manager?.accountId === "bootstrap";',
    'const manager = currentManager(); const isOwner = manager?.role === "owner" || manager?.accountId === "bootstrap"; ' + extraLocations,
    "extra locations state",
  );
}

if (source.includes('...(s.locations || [])].map(location =>')) {
  replaceOnce('...(s.locations || [])].map(location =>', '...extraLocations].map(location =>', "work-site list deduplication");
} else if (!source.includes('...extraLocations].map(location =>')) {
  fail("work-site list anchor not found");
}

if (source.includes('{(s.locations || []).length + 1} مواقع مسجلة')) {
  replaceOnce('{(s.locations || []).length + 1} مواقع مسجلة', '{extraLocations.length + 1} مواقع مسجلة', "work-site count");
} else if (!source.includes('{extraLocations.length + 1} مواقع مسجلة')) {
  fail("work-site count anchor not found");
}

const addLocationButton = '          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03]';
if (!source.includes('data-hadir-qr-settings')) {
  const qrBlock = String.raw`          <div data-hadir-qr-settings className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="qr" /></span><div><div className="text-[10px] font-black text-primary mono">04 · QR ACCESS</div><h2 className="mt-0.5 text-lg font-black">رمز QR</h2><p className="mt-1 text-xs text-muted-foreground">الرمز المستخدم للتحقق من موقع الحضور والانصراف.</p></div></div></div>
            <div ref={printRef} className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_260px] sm:p-6">
              <div className="min-w-0 space-y-4"><div><div className="text-sm font-black">رمز الموقع الحالي</div><p className="mt-1 text-xs leading-6 text-muted-foreground">يمكنك تغيير الرمز أو طباعته مع الحفاظ على نفس آلية التحقق الحالية.</p></div><div className="rounded-2xl border border-border/60 bg-muted/20 p-3"><div className="text-[10px] text-muted-foreground">QR CODE</div><div className="mt-1 break-all font-black mono text-sm">{s.qrCode || loginUrl}</div></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={generateQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM20 17v3h-3M17 20h3"/></svg>توليد رمز جديد</button><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={printQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v6H6z"/></svg>طباعة الرمز</button></div></div>
              <div className="mx-auto w-full max-w-[260px] rounded-3xl border border-border/60 bg-white p-4 shadow-sm"><img src={"https://api.qrserver.com/v1/create-qr-code/?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=" + encodeURIComponent(s.qrCode || loginUrl)} alt="QR" className="block aspect-square w-full" loading="eager" /></div>
            </div>
          </div>
`;
  const index = source.indexOf(addLocationButton);
  if (index < 0) fail("QR insertion anchor not found");
  source = source.slice(0, index) + qrBlock + source.slice(index);
}

writeFileSync(file, source, "utf8");
console.log("ManagerSettings locations fixes: duplicate main site removed from the UI list and QR settings restored below work sites.");
