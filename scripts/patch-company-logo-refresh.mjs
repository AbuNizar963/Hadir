import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/components/settings/CompanySpecialtiesPanel.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `  async function saveLogo() {
    if (!pendingLogo || saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      await uploadCompanyLogo(pendingLogo);
      const remote = await getBackendSettings();
      applyRemoteSettings(remote);
      setBrandName(remote.brandName || "");
      setBrandLogo(remote.brandLogo || null);
      setPendingLogo(null);
      setMessage("تم حفظ الشعار في R2 وربطه بسجل الهوية في D1.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر حفظ الشعار"); }
    finally { setSaving(false); }
  }`;

const newBlock = `  async function saveLogo() {
    if (!pendingLogo || saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      // The upload response contains the cache-busted URL generated from the
      // new R2 object's ETag. Use it immediately instead of re-reading the
      // possibly stale D1 settings row (especially while D1 is rate-limited).
      const uploadedUrl = await uploadCompanyLogo(pendingLogo);
      setBrandLogo(uploadedUrl);
      setPendingLogo(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));

      try {
        const remote = await getBackendSettings();
        const refreshed = { ...remote, brandLogo: uploadedUrl } as Settings;
        applyRemoteSettings(refreshed);
        setBrandName(refreshed.brandName || "");
        setBrandLogo(uploadedUrl);
      } catch {
        // R2 upload already succeeded; keep the new URL visible locally even
        // if D1 is temporarily unavailable or still serving an older setting.
      }
      setMessage("تم استبدال الشعار القديم بالشعار الجديد وحفظه في R2.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر حفظ الشعار"); }
    finally { setSaving(false); }
  }`;

if (source.includes(newBlock)) {
  console.log("Company logo refresh patch: already applied.");
  process.exit(0);
}
if (!source.includes(oldBlock)) {
  throw new Error("Company logo refresh patch: saveLogo anchor not found; refusing unsafe replacement.");
}
source = source.replace(oldBlock, newBlock);
writeFileSync(file, source, "utf8");
console.log("Company logo refresh patch: the newly uploaded R2 URL is applied immediately and is never overwritten by a stale D1 response.");
