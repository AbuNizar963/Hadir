import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerSettings locations fixes: ${message}; refusing unsafe replacement.`); };
const replaceOnce = (anchor, replacement, label) => {
  const index = source.indexOf(anchor);
  if (index < 0) fail(`${label} anchor not found`);
  source = source.slice(0, index) + replacement + source.slice(index + anchor.length);
};

const extraLocations = 'const extraLocations = (s.locations || []).filter((location) => String(location.name || "").trim() !== "المقر الرئيسي");';
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

const qrStart = source.indexOf('          <div data-hadir-qr-settings');
const addStart = source.indexOf('          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30');
if (qrStart < 0 || addStart < 0 || addStart <= qrStart) {
  if (source.includes('data-hadir-qr-settings') && source.includes('border-dashed border-primary/30')) {
    fail("QR/add-site block order is unexpected; refusing unsafe rewrite");
  }
  fail("QR or add-site block anchor not found");
}

const addEnd = source.indexOf('</button>', addStart);
if (addEnd < 0) fail("add-site button closing anchor not found");
const addBlock = source.slice(addStart, addEnd + '</button>'.length);

const qrBlock = String.raw`          <div data-hadir-qr-settings className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SectionIcon type="qr" /></span><div><div className="text-[10px] font-black text-primary mono">04 · QR ACCESS</div><h2 className="mt-0.5 text-lg font-black">رمز QR</h2><p className="mt-1 text-xs text-muted-foreground">الرمز المستخدم للتحقق من موقع الحضور والانصراف.</p></div></div></div>
            <div className="space-y-5 p-5 sm:p-6">
              <div><div className="text-sm font-black">رمز الموقع الحالي</div><p className="mt-1 text-xs leading-6 text-muted-foreground">يمكنك تغيير الرمز أو طباعته مع الحفاظ على نفس آلية التحقق الحالية.</p></div>
              <div ref={printRef} className="mx-auto w-full max-w-[430px] rounded-3xl border border-border/70 bg-white p-5 text-center text-black shadow-sm sm:p-6">
                <b className="block text-xl mb-3">{s.brandName || "حاضِر"}</b>
                <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 p-2 rounded-2xl border-[3mm] border-green-600 bg-white shadow-[0_8px_24px_rgba(22,163,74,.12)]">
                  <div className="relative w-full h-full overflow-hidden">
                    <img src={"https://api.qrserver.com/v1/create-qr-code/?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=" + encodeURIComponent(s.qrCode || loginUrl)} alt="QR" className="w-full h-full" loading="eager" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden grid place-items-center"><img src={PROJECT_LOGO} alt={s.brandName || "حاضِر"} className="w-full h-full object-contain" /></div>
                  </div>
                </div>
                <small className="block mt-3 font-mono">{s.qrCode || loginUrl}</small>
              </div>
              <div className="flex flex-wrap justify-center gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={generateQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM20 17v3h-3M17 20h3"/></svg>توليد رمز جديد</button><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={printQr}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v6H6z"/></svg>طباعة الرمز</button></div>
            </div>
          </div>
`;

source = source.slice(0, qrStart) + addBlock + '\n' + qrBlock + source.slice(addEnd + '</button>'.length);
writeFileSync(file, source, "utf8");
console.log("ManagerSettings locations fixes: canonical main site shown once, restored previous QR visual design, and moved add-site action directly below the last work site.");
